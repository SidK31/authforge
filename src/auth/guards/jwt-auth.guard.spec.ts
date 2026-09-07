import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function createContext(
  authorization?: string,
  initialUser?: { sub: string; email: string },
): ExecutionContext {
  const request = {
    headers: authorization ? { authorization } : {},
    user: initialUser,
  };

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
    },
  };
}

const verificationOptions = {
  algorithms: ['HS256'],
  issuer: 'authforge',
  audience: 'authforge-api',
};

describe('JwtAuthGuard', () => {
  it('allows routes marked public', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects requests without a bearer token', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('loads the current active identity from the database', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        email: 'stale@example.com',
      }),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'current@example.com',
      isActive: true,
    });
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);
    const context = createContext('Bearer valid-token');
    const request = context.switchToHttp().getRequest() as {
      user?: { sub: string; email: string };
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
    expect(request.user).toEqual({
      sub: 'user-id',
      email: 'current@example.com',
    });
  });

  it('rejects a valid token when its user no longer exists', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'deleted-user-id',
        email: 'user@example.com',
      }),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await expect(
      guard.canActivate(createContext('Bearer valid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a valid token when its user is deactivated', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'inactive-user-id',
        email: 'user@example.com',
      }),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'inactive-user-id',
      email: 'user@example.com',
      isActive: false,
    });
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await expect(
      guard.canActivate(createContext('Bearer valid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid tokens', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('invalid token')),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await expect(
      guard.canActivate(createContext('Bearer invalid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('passes strict verification constraints to the JWT library', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        email: 'user@example.com',
      }),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      isActive: true,
    });
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await guard.canActivate(createContext('Bearer token'));

    expect(jwt.verifyAsync).toHaveBeenCalledWith('token', verificationOptions);
  });

  it('rejects tokens when JWT verification fails for issuer, audience, algorithm, or expiry', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockRejectedValue(new Error('jwt verification failed')),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);

    await expect(
      guard.canActivate(createContext('Bearer forged-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('overwrites a pre-existing request identity with the current database identity', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'verified-user-id',
        email: 'stale@example.com',
      }),
    } as unknown as JwtService;
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'verified-user-id',
      email: 'verified@example.com',
      isActive: true,
    });
    const guard = new JwtAuthGuard(jwt, reflector, prisma as never);
    const context = createContext('Bearer valid-token', {
      sub: 'attacker-user-id',
      email: 'attacker@example.com',
    });
    const request = context.switchToHttp().getRequest() as {
      user?: { sub: string; email: string };
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toEqual({
      sub: 'verified-user-id',
      email: 'verified@example.com',
    });
  });
});
