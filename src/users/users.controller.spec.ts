import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('loads the authenticated user profile from the users service', async () => {
    const usersService = {
      getCurrentUser: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isActive: true,
        isVerified: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    };
    const controller = new UsersController(usersService as never);

    await expect(
      controller.getMe({
        user: {
          sub: 'user-id',
          email: 'stale@example.com',
        },
      } as never),
    ).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      isActive: true,
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(usersService.getCurrentUser).toHaveBeenCalledWith('user-id');
  });
});
