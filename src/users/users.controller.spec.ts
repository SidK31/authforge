import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('returns the authenticated user profile', () => {
    const controller = new UsersController();

    expect(
      controller.getMe({
        user: {
          sub: 'user-id',
          email: 'user@example.com',
        },
      } as never),
    ).toEqual({
      id: 'user-id',
      email: 'user@example.com',
    });
  });
});
