import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { PermissionsGuard } from './permissions.guard';

function createContext(userId?: string): ExecutionContext {
  const request = {
    user: userId
      ? {
          sub: userId,
          email: 'user@example.com',
        }
      : undefined,
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

    await expect(guard.canActivate(createContext('user-id'))).resolves.toBe(
      true,
    );
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

    await expect(guard.canActivate(createContext('user-id'))).resolves.toBe(
      true,
    );
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

    await expect(
      guard.canActivate(createContext('user-id')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires every declared permission, not just one of them', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['roles:read', 'users:read']),
    } as unknown as Reflector;
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              permissions: [{ permission: { name: 'roles:read' } }],
            },
          },
        ]),
      },
    } as unknown as PrismaService;
    const guard = new PermissionsGuard(reflector, prisma);

    await expect(
      guard.canActivate(createContext('user-id')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a request without a verified identity', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['roles:read']),
    } as unknown as Reflector;
    const prisma = {
      userRole: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const guard = new PermissionsGuard(reflector, prisma);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });
});
