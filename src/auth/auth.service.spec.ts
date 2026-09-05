import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { AuthService } from './auth.service';

function createPrismaMock() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
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

function createJwtMock() {
  return {
    signAsync: jest.fn(),
  };
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

describe('AuthService', () => {
  it('normalizes the email and creates a user without returning the password hash', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      isActive: true,
      isVerified: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const service = new AuthService(prisma as never, createJwtMock() as never);

    const result = await service.register({
      email: '  USER@Example.COM ',
      password: 'a-secure-password-123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: 'user@example.com',
          passwordHash: expect.stringMatching(/^scrypt:[^:]+:[0-9a-f]+$/),
        },
      }),
    );
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).not.toContain(
      'a-secure-password-123',
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects an email that already has an account', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    const service = new AuthService(prisma as never, createJwtMock() as never);

    await expect(
      service.register({
        email: 'USER@example.com',
        password: 'a-secure-password-123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('handles a database unique constraint race during registration', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.0.0',
      },
    );
    prisma.user.create.mockRejectedValue(uniqueConstraintError);

    const service = new AuthService(prisma as never, createJwtMock() as never);

    await expect(
      service.register({
        email: 'race@example.com',
        password: 'a-secure-password-123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in an active user, creates a session, and returns tokens', async () => {
    const prisma = createPrismaMock();
    const jwt = createJwtMock();
    const passwordHash = createPasswordHash('a-secure-password-123');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash,
      isActive: true,
    });
    prisma.session.create.mockResolvedValue({ id: 'session-id' });
    jwt.signAsync.mockResolvedValue('signed-access-token');

    const service = new AuthService(prisma as never, jwt as never);
    const result = await service.login({
      email: ' USER@Example.COM ',
      password: 'a-secure-password-123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        refreshTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        tokenFamilyId: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'user@example.com',
    });
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
  });

  it('uses the same generic error for unknown users and wrong passwords', async () => {
    const prisma = createPrismaMock();
    const jwt = createJwtMock();
    const service = new AuthService(prisma as never, jwt as never);

    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@example.com', password: 'wrong' }),
    ).rejects.toEqual(new UnauthorizedException('Invalid email or password'));

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: createPasswordHash('correct-password'),
      isActive: true,
    });
    await expect(
      service.login({ email: 'user@example.com', password: 'wrong-password' }),
    ).rejects.toEqual(new UnauthorizedException('Invalid email or password'));
  });

  it('rejects inactive users before checking their password', async () => {
    const prisma = createPrismaMock();
    const service = new AuthService(prisma as never, createJwtMock() as never);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: createPasswordHash('correct-password'),
      isActive: false,
    });

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'correct-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates a refresh token and preserves the token family', async () => {
    const prisma = createPrismaMock();
    const jwt = createJwtMock();
    const service = new AuthService(prisma as never, jwt as never);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      refreshTokenHash: 'old-hash',
      tokenFamilyId: 'family-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedAt: null,
      user: {
        id: 'user-id',
        email: 'user@example.com',
        isActive: true,
      },
    });
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    prisma.session.create.mockResolvedValue({ id: 'next-session-id' });
    jwt.signAsync.mockResolvedValue('new-access-token');

    const result = await service.refresh({ refreshToken: 'a'.repeat(64) });

    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id', revokedAt: null },
        data: expect.objectContaining({
          replacedAt: expect.any(Date),
          revokedReason: 'rotated',
        }),
      }),
    );
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        tokenFamilyId: 'family-id',
        refreshTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(result.accessToken).toBe('new-access-token');
  });

  it('rejects a concurrent refresh when another request already rotated the token', async () => {
    const prisma = createPrismaMock();
    const jwt = createJwtMock();
    const service = new AuthService(prisma as never, jwt as never);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      refreshTokenHash: 'old-hash',
      tokenFamilyId: 'family-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedAt: null,
      user: {
        id: 'user-id',
        email: 'user@example.com',
        isActive: true,
      },
    });
    prisma.session.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.session.create.mockResolvedValue({ id: 'next-session-id' });
    jwt.signAsync.mockResolvedValue('new-access-token');

    const results = await Promise.allSettled([
      service.refresh({ refreshToken: 'a'.repeat(64) }),
      service.refresh({ refreshToken: 'a'.repeat(64) }),
    ]);

    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    );
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toEqual(
      new UnauthorizedException('Invalid refresh token'),
    );
    expect(prisma.session.create).toHaveBeenCalledTimes(1);
    expect(prisma.session.updateMany).toHaveBeenLastCalledWith({
      where: {
        userId: 'user-id',
        tokenFamilyId: 'family-id',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'refresh-token-reuse-detected',
      },
    });
  });

  it('binds the rotated session and access token to the stored session owner', async () => {
    const prisma = createPrismaMock();
    const jwt = createJwtMock();
    const service = new AuthService(prisma as never, jwt as never);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'owner-user-id',
      tokenFamilyId: 'family-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedAt: null,
      user: {
        id: 'owner-user-id',
        email: 'owner@example.com',
        isActive: true,
      },
    });
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    prisma.session.create.mockResolvedValue({ id: 'next-session-id' });
    jwt.signAsync.mockResolvedValue('new-access-token');

    await service.refresh({ refreshToken: 'a'.repeat(64) });

    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-user-id',
        tokenFamilyId: 'family-id',
      }),
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'owner-user-id',
      email: 'owner@example.com',
    });
  });

  it('revokes the token family when a rotated refresh token is reused', async () => {
    const prisma = createPrismaMock();
    const service = new AuthService(prisma as never, createJwtMock() as never);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      tokenFamilyId: 'family-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      replacedAt: new Date(),
      user: { id: 'user-id', email: 'user@example.com', isActive: true },
    });
    prisma.session.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.refresh({ refreshToken: 'a'.repeat(64) }),
    ).rejects.toEqual(new UnauthorizedException('Invalid refresh token'));

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        tokenFamilyId: 'family-id',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'refresh-token-reuse-detected',
      },
    });
  });

  it('revokes a refresh token on logout', async () => {
    const prisma = createPrismaMock();
    const service = new AuthService(prisma as never, createJwtMock() as never);
    prisma.session.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.logout({ refreshToken: 'a'.repeat(64) }),
    ).resolves.toEqual({ success: true });

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        refreshTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'logout',
      },
    });
  });

  it('verifies a correct password and rejects an incorrect password', async () => {
    const service = new AuthService(
      createPrismaMock() as never,
      createJwtMock() as never,
    );
    const passwordHash = createPasswordHash('a-secure-password-123');

    await expect(
      service.verifyPassword('a-secure-password-123', passwordHash),
    ).resolves.toBe(true);
    await expect(
      service.verifyPassword('wrong-password', passwordHash),
    ).resolves.toBe(false);
  });

  it('rejects malformed password hashes', async () => {
    const service = new AuthService(
      createPrismaMock() as never,
      createJwtMock() as never,
    );

    await expect(
      service.verifyPassword('a-secure-password-123', 'invalid'),
    ).resolves.toBe(false);
  });
});
