import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

export const AUTH_ABUSE_REDIS = Symbol('AUTH_ABUSE_REDIS');

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 5 * 60_000;
const REFRESH_LIMIT = 30;
const REFRESH_WINDOW_MS = 60_000;

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

@Injectable()
export class AuthAbuseService {
  private readonly logger = new Logger(AuthAbuseService.name);

  constructor(
    @Optional()
    @Inject(AUTH_ABUSE_REDIS)
    private readonly redis?: Redis,
  ) {}

  async assertLoginAllowed(email: string, ipAddress?: string) {
    if (!this.redis) {
      this.ensureProductionProtection();
      return;
    }

    const dimensions = [
      this.key('login:ip', ipAddress ?? 'unknown'),
      this.key('login:email', email.trim().toLowerCase()),
    ];

    try {
      const counts = await Promise.all(
        dimensions.map((key) => this.increment(key, LOGIN_WINDOW_MS)),
      );

      if (counts.some((count) => count > LOGIN_LIMIT)) {
        throw new HttpException(
          'Too many authentication attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.failClosed(error, 'login');
    }
  }

  async clearLoginFailures(email: string, ipAddress?: string) {
    if (!this.redis) {
      return;
    }

    const keys = [
      this.key('login:ip', ipAddress ?? 'unknown'),
      this.key('login:email', email.trim().toLowerCase()),
    ];

    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn(
        `Failed to clear authentication attempt counters: ${this.errorMessage(error)}`,
      );
    }
  }

  async assertRefreshAllowed(ipAddress?: string) {
    if (!this.redis) {
      this.ensureProductionProtection();
      return;
    }

    try {
      const count = await this.increment(
        this.key('refresh:ip', ipAddress ?? 'unknown'),
        REFRESH_WINDOW_MS,
      );

      if (count > REFRESH_LIMIT) {
        throw new HttpException(
          'Too many refresh attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.failClosed(error, 'refresh');
    }
  }

  private async increment(key: string, windowMs: number) {
    const result = await this.redis!.eval(
      INCREMENT_WITH_EXPIRY_SCRIPT,
      1,
      key,
      String(windowMs),
    );

    return Number(result);
  }

  private key(scope: string, value: string) {
    const digest = createHash('sha256').update(value).digest('hex');
    return `authforge:abuse:${scope}:${digest}`;
  }

  private ensureProductionProtection() {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Authentication abuse protection is unavailable',
      );
    }
  }

  private failClosed(error: unknown, scope: string): never {
    this.logger.error(
      `Redis authentication abuse control failed for ${scope}: ${this.errorMessage(error)}`,
    );
    throw new ServiceUnavailableException(
      'Authentication abuse protection is unavailable',
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
