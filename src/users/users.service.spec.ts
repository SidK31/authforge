import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
    },
  };
}

describe('UsersService', () => {
  it('returns current server-side user state without the password hash', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'current@example.com',
      isActive: true,
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = new UsersService(prisma as never);

    await expect(service.getCurrentUser('user-id')).resolves.toEqual({
      id: 'user-id',
      email: 'current@example.com',
      isActive: true,
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: {
        id: true,
        email: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });
  });

  it('rejects a user that no longer exists', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new UsersService(prisma as never);

    await expect(
      service.getCurrentUser('missing-user-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a deactivated user', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'inactive-user-id',
      email: 'user@example.com',
      isActive: false,
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = new UsersService(prisma as never);

    await expect(
      service.getCurrentUser('inactive-user-id'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
