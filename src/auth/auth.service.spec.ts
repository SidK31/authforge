import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { AuthService } from './auth.service';

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
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

  it('logs in an active user and returns a short-lived access token', async () => {
    const prisma = createPrismaMock();
    const jwt = createJwtMock();
    const passwordHash = createPasswordHash('a-secure-password-123');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash,
      isActive: true,
    });
    jwt.signAsync.mockResolvedValue('signed-access-token');

    const service = new AuthService(prisma as never, jwt as never);
    const result = await service.login({
      email: ' USER@Example.COM ',
      password: 'a-secure-password-123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'user@example.com',
    });
    expect(result).toEqual({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
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
