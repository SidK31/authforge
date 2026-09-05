import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { PermissionsGuard } from './permissions.guard';

function createContext(userId = 'user-id'): ExecutionContext {
  const request = {
    user: {
      sub: userId,
      email: 'user@example.com',
    },
  };

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows routes without permission requirements', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const prisma = {
      userRole: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const guard = new PermissionsGuard(reflector, prisma);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });

  it('allows a user with every required permission', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['roles:read']),
    } as unknown as Reflector;
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              permissions: [
                { permission: { name: 'roles:read' } },
                { permission: { name: 'users:read' } },
              ],
            },
          },
        ]),
      },
    } as unknown as PrismaService;
    const guard = new PermissionsGuard(reflector, prisma);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('rejects a user without the required permission', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['roles:read']),
    } as unknown as Reflector;
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              permissions: [{ permission: { name: 'users:read' } }],
            },
          },
        ]),
      },
    } as unknown as PrismaService;
    const guard = new PermissionsGuard(reflector, prisma);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
