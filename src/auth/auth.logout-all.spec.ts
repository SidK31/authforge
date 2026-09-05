import { AuthService } from './auth.service';

describe('AuthService logout-all', () => {
  it('revokes every active session for the authenticated user', async () => {
    const prisma = {
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const jwt = { signAsync: jest.fn() };
    const service = new AuthService(prisma as never, jwt as never);

    await expect(service.logoutAll('user-id')).resolves.toEqual({
      success: true,
      revokedSessions: 3,
    });

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: 'logout-all',
      },
    });
  });
});
