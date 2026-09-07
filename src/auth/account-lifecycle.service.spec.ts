import { UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AccountLifecycleService } from './account-lifecycle.service';

function createPrismaMock() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    accountToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
  );
  return prisma;
}

describe('AccountLifecycleService', () => {
  it('creates a long random verification token and stores only its hash', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.create.mockResolvedValue({ id: 'token-id' });
    const service = new AccountLifecycleService(prisma as never);

    const token = await service.issueVerificationToken('user-id');

    expect(token).toHaveLength(43);
    expect(prisma.accountToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        type: 'EMAIL_VERIFICATION',
        tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(prisma.accountToken.create.mock.calls[0][0].data.tokenHash).not.toBe(
      token,
    );
  });

  it('invalidates an earlier token before creating a replacement', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.create.mockResolvedValue({ id: 'token-id' });
    const service = new AccountLifecycleService(prisma as never);

    await service.issuePasswordResetToken('user-id');

    expect(prisma.accountToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        type: 'PASSWORD_RESET',
        consumedAt: null,
      },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it('returns the same reset response for an unknown email', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new AccountLifecycleService(prisma as never);

    await expect(
      service.requestPasswordReset('missing@example.com'),
    ).resolves.toEqual({
      message:
        'If the email address is in our system, a password reset link will be sent.',
    });
    expect(prisma.accountToken.create).not.toHaveBeenCalled();
  });

  it('rejects an expired verification token', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() - 1_000),
      consumedAt: null,
      user: { isActive: true, isVerified: false },
    });
    const service = new AccountLifecycleService(prisma as never);

    await expect(service.verifyEmail('a'.repeat(43))).rejects.toEqual(
      new UnauthorizedException('Invalid or expired verification token'),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('consumes a valid verification token and marks the account verified', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { isActive: true, isVerified: false },
    });
    prisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({ id: 'user-id', isVerified: true });
    const service = new AccountLifecycleService(prisma as never);

    await expect(service.verifyEmail('a'.repeat(43))).resolves.toEqual({
      success: true,
    });
    expect(prisma.accountToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'token-id',
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { isVerified: true },
    });
  });

  it('rejects a password reset token that was already consumed', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      user: { isActive: true },
    });
    const service = new AccountLifecycleService(prisma as never);

    await expect(
      service.resetPassword('a'.repeat(43), 'new-secure-password-123'),
    ).rejects.toEqual(
      new UnauthorizedException('Invalid or expired password reset token'),
    );
  });

  it('changes the password and revokes active sessions after reset', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { isActive: true },
    });
    prisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({ id: 'user-id' });
    prisma.session.updateMany.mockResolvedValue({ count: 2 });
    const service = new AccountLifecycleService(prisma as never);

    await expect(
      service.resetPassword('a'.repeat(43), 'new-secure-password-123'),
    ).resolves.toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { passwordHash: expect.stringMatching(/^scrypt:[^:]+:[0-9a-f]+$/) },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'password-reset',
      },
    });
  });

  it('does not store raw token material in the database calls', async () => {
    const prisma = createPrismaMock();
    prisma.accountToken.create.mockResolvedValue({ id: 'token-id' });
    const service = new AccountLifecycleService(prisma as never);
    const token = randomBytes(32).toString('base64url');

    await service.issuePasswordResetToken('user-id');

    const stored = prisma.accountToken.create.mock.calls[0][0].data.tokenHash;
    expect(stored).not.toBe(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });
});
