import { ConflictException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';

function createJwtMock() {
  return {
    signAsync: jest.fn(),
  };
}

describe('AuthService registration', () => {
  const user = {
    id: 'user-id',
    email: 'user@example.com',
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
  };

  it('normalizes the email and never returns the password hash', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(user),
      },
    };

    const service = new AuthService(prisma as never, createJwtMock() as never);
    const result = await service.register({
      email: '  USER@EXAMPLE.COM ',
      password: 'a-strong-password-123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'user@example.com' }),
      }),
    );
    expect(result).toEqual(user);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate email addresses', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-user' }),
        create: jest.fn(),
      },
    };

    const service = new AuthService(prisma as never, createJwtMock() as never);

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'a-strong-password-123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
