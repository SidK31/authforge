import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { AuditContext, AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AccountLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async requestEmailVerification(
    email: string,
    context?: AuditContext,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isVerified: true, isActive: true },
    });

    if (user && user.isActive && !user.isVerified) {
      await this.issueVerificationToken(user.id);
      await this.audit?.record(
        'EMAIL_VERIFICATION_REQUESTED',
        user.id,
        context,
      );
    }

    return {
      message:
        'If the email address is eligible, a verification link will be sent.',
    };
  }

  async verifyEmail(token: string, context?: AuditContext) {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const accountToken = await tx.accountToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          type: true,
          expiresAt: true,
          consumedAt: true,
          user: { select: { isActive: true, isVerified: true } },
        },
      });

      if (
        !accountToken ||
        accountToken.type !== 'EMAIL_VERIFICATION' ||
        accountToken.consumedAt ||
        accountToken.expiresAt <= now ||
        !accountToken.user.isActive
      ) {
        throw new UnauthorizedException('Invalid or expired verification token');
      }

      const consumed = await tx.accountToken.updateMany({
        where: {
          id: accountToken.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Invalid or expired verification token');
      }

      await tx.user.update({
        where: { id: accountToken.userId },
        data: { isVerified: true },
      });

      return accountToken.userId;
    });

    await this.audit?.record('EMAIL_VERIFIED', result, context);
    return { success: true };
  }

  async requestPasswordReset(
    email: string,
    context?: AuditContext,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });

    if (user?.isActive) {
      await this.issuePasswordResetToken(user.id);
      await this.audit?.record('PASSWORD_RESET_REQUESTED', user.id, context);
    }

    return {
      message:
        'If the email address is in our system, a password reset link will be sent.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    context?: AuditContext,
  ) {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const passwordHash = await this.hashPassword(newPassword);

    const userId = await this.prisma.$transaction(async (tx) => {
      const accountToken = await tx.accountToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          type: true,
          expiresAt: true,
          consumedAt: true,
          user: { select: { isActive: true } },
        },
      });

      if (
        !accountToken ||
        accountToken.type !== 'PASSWORD_RESET' ||
        accountToken.consumedAt ||
        accountToken.expiresAt <= now ||
        !accountToken.user.isActive
      ) {
        throw new UnauthorizedException('Invalid or expired password reset token');
      }

      const consumed = await tx.accountToken.updateMany({
        where: {
          id: accountToken.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Invalid or expired password reset token');
      }

      await tx.user.update({
        where: { id: accountToken.userId },
        data: { passwordHash },
      });

      await tx.session.updateMany({
        where: { userId: accountToken.userId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: 'password-reset',
        },
      });

      return accountToken.userId;
    });

    await this.audit?.record('PASSWORD_RESET_COMPLETED', userId, context);
    return { success: true };
  }

  async issueVerificationToken(userId: string) {
    return this.issueToken(
      userId,
      'EMAIL_VERIFICATION',
      VERIFICATION_TOKEN_TTL_MS,
    );
  }

  async issuePasswordResetToken(userId: string) {
    return this.issueToken(
      userId,
      'PASSWORD_RESET',
      PASSWORD_RESET_TOKEN_TTL_MS,
    );
  }

  private async issueToken(userId: string, type: string, ttlMs: number) {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashToken(token);

    await this.prisma.$transaction(async (tx) => {
      await tx.accountToken.updateMany({
        where: {
          userId,
          type,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      await tx.accountToken.create({
        data: {
          userId,
          tokenHash,
          type,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });
    });

    return token;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }
}
