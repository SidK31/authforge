import {
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { AuditContext, AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ACCESS_TOKEN_TTL_SECONDS = 900;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  'scrypt:61757468666f7267652d64756d6d792d73616c74:9932b8301727dfe88026c5c1230a96cad59076f2d670e5b22486399b96ffd8bf9dea41129dc0aec99f02c7493cf560d0a38c318151af80ac34b681e35664b07c';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async register(input: RegisterDto, context?: AuditContext) {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hashPassword(input.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
        },
      });

      await this.audit?.record('REGISTER_SUCCESS', user.id, context);
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(input: LoginDto, context?: AuditContext) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const passwordMatches = await this.verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.isActive || !passwordMatches) {
      await this.audit?.record('LOGIN_FAILURE', user?.id, context, {
        reason: !user
          ? 'user-not-found'
          : !user.isActive
            ? 'user-inactive'
            : 'invalid-password',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const refreshToken = this.createRefreshToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        tokenFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent: context?.userAgent,
        ipAddress: context?.ipAddress,
      },
    });

    await this.audit?.record('LOGIN_SUCCESS', user.id, context);
    return this.createTokenResponse(user.id, user.email, refreshToken);
  }

  async refresh(input: RefreshTokenDto, context?: AuditContext) {
    const tokenHash = this.hashRefreshToken(input.refreshToken);

    const response = await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { refreshTokenHash: tokenHash },
        include: { user: true },
      });

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (session.revokedAt) {
        if (session.replacedAt) {
          await tx.session.updateMany({
            where: {
              userId: session.userId,
              tokenFamilyId: session.tokenFamilyId,
              revokedAt: null,
            },
            data: {
              revokedAt: new Date(),
              revokedReason: 'refresh-token-reuse-detected',
            },
          });
        }

        throw new UnauthorizedException('Invalid refresh token');
      }

      if (session.expiresAt <= new Date() || !session.user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const nextRefreshToken = this.createRefreshToken();
      const now = new Date();
      const replacement = await tx.session.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          replacedAt: now,
          lastUsedAt: now,
          revokedReason: 'rotated',
        },
      });

      if (replacement.count !== 1) {
        await tx.session.updateMany({
          where: {
            userId: session.userId,
            tokenFamilyId: session.tokenFamilyId,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokedReason: 'refresh-token-reuse-detected',
          },
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      await tx.session.create({
        data: {
          userId: session.userId,
          refreshTokenHash: this.hashRefreshToken(nextRefreshToken),
          tokenFamilyId: session.tokenFamilyId,
          expiresAt: session.expiresAt,
          userAgent: context?.userAgent,
          ipAddress: context?.ipAddress,
        },
      });

      return {
        userId: session.user.id,
        tokenResponse: await this.createTokenResponse(
          session.user.id,
          session.user.email,
          nextRefreshToken,
        ),
      };
    });

    await this.audit?.record('REFRESH_SUCCESS', response.userId, context);
    return response.tokenResponse;
  }

  async logout(input: RefreshTokenDto, context?: AuditContext) {
    const tokenHash = this.hashRefreshToken(input.refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: { userId: true },
    });
    const result = await this.prisma.session.updateMany({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'logout',
      },
    });

    await this.audit?.record('LOGOUT', session?.userId, context, {
      sessionRevoked: result.count === 1,
    });

    return { success: true };
  }

  async logoutAll(userId: string, context?: AuditContext) {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'logout-all',
      },
    });

    await this.audit?.record('LOGOUT_ALL', userId, context, {
      revokedSessions: result.count,
    });

    return {
      success: true,
      revokedSessions: result.count,
    };
  }

  async verifyPassword(password: string, passwordHash: string) {
    const [algorithm, salt, storedKey] = passwordHash.split(':');

    if (
      algorithm !== 'scrypt' ||
      !salt ||
      !storedKey ||
      storedKey.length !== KEY_LENGTH * 2
    ) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    const expectedKey = Buffer.from(storedKey, 'hex');

    return (
      expectedKey.length === derivedKey.length &&
      timingSafeEqual(expectedKey, derivedKey)
    );
  }

  private async createTokenResponse(
    userId: string,
    email: string,
    refreshToken: string,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      email,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private createRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }
}
