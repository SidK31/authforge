import {
  ConflictException,
  Injectable,
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
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ACCESS_TOKEN_TTL_SECONDS = 900;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hashPassword(input.password);

    try {
      return await this.prisma.user.create({
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

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const refreshToken = this.createRefreshToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        tokenFamilyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return this.createTokenResponse(user.id, user.email, refreshToken);
  }

  async refresh(input: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(input.refreshToken);

    return this.prisma.$transaction(async (tx) => {
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
        },
      });

      return this.createTokenResponse(
        session.user.id,
        session.user.email,
        nextRefreshToken,
      );
    });
  }

  async logout(input: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(input.refreshToken);
    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'logout',
      },
    });

    return { success: true };
  }

  async logoutAll(userId: string) {
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
