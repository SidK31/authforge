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
    const guard = new JwtAuthGuard(jwt, reflector);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects requests without a bearer token', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt, reflector);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the verified token subject to the request', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        email: 'user@example.com',
      }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt, reflector);
    const context = createContext('Bearer valid-token');
    const request = context.switchToHttp().getRequest() as {
      user?: { sub: string; email: string };
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith(
      'valid-token',
      verificationOptions,
    );
    expect(request.user).toEqual({
      sub: 'user-id',
      email: 'user@example.com',
    });
  });

  it('rejects invalid tokens', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('invalid token')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt, reflector);

    await expect(
      guard.canActivate(createContext('Bearer invalid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
    const guard = new JwtAuthGuard(jwt, reflector);

    await guard.canActivate(createContext('Bearer token'));

    expect(jwt.verifyAsync).toHaveBeenCalledWith('token', {
      algorithms: ['HS256'],
      issuer: 'authforge',
      audience: 'authforge-api',
    });
  });

  it('overwrites a pre-existing request identity with the verified JWT identity', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'verified-user-id',
        email: 'verified@example.com',
      }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt, reflector);
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

  it('rejects tokens when JWT verification fails for issuer, audience, algorithm, or expiry', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockRejectedValue(new Error('jwt verification failed')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwt, reflector);

    await expect(
      guard.canActivate(createContext('Bearer forged-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
