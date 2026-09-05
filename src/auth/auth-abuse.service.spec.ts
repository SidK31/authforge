import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AuthAbuseService } from './auth-abuse.service';

function createRedisMock() {
  return {
    eval: jest.fn(),
    del: jest.fn(),
  } as unknown as Redis;
}

describe('AuthAbuseService', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('throttles login attempts when either IP or email exceeds the limit', async () => {
    const redis = createRedisMock();
    const service = new AuthAbuseService(redis);
    (redis.eval as jest.Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);

    await expect(
      service.assertLoginAllowed('user@example.com', '203.0.113.10'),
    ).rejects.toEqual(
      new HttpException(
        'Too many authentication attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    expect(redis.eval).toHaveBeenCalledTimes(2);
  });

  it('hashes security dimensions before storing Redis keys', async () => {
    const redis = createRedisMock();
    const service = new AuthAbuseService(redis);
    (redis.eval as jest.Mock).mockResolvedValue(1);

    await service.assertLoginAllowed('User@Example.com', '203.0.113.10');

    const calls = (redis.eval as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][2]).toMatch(/^authforge:abuse:login:ip:[0-9a-f]{64}$/);
    expect(calls[1][2]).toMatch(/^authforge:abuse:login:email:[0-9a-f]{64}$/);
    expect(calls[1][2]).not.toContain('User@Example.com');
  });

  it('clears login counters after a successful authentication', async () => {
    const redis = createRedisMock();
    const service = new AuthAbuseService(redis);
    (redis.del as jest.Mock).mockResolvedValue(2);

    await service.clearLoginFailures('user@example.com', '203.0.113.10');

    expect(redis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^authforge:abuse:login:ip:[0-9a-f]{64}$/),
      expect.stringMatching(/^authforge:abuse:login:email:[0-9a-f]{64}$/),
    );
  });

  it('throttles refresh attempts by IP', async () => {
    const redis = createRedisMock();
    const service = new AuthAbuseService(redis);
    (redis.eval as jest.Mock).mockResolvedValue(31);

    await expect(
      service.assertRefreshAllowed('203.0.113.10'),
    ).rejects.toEqual(
      new HttpException(
        'Too many refresh attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it('fails closed in production when Redis is not configured', async () => {
    process.env.NODE_ENV = 'production';
    const service = new AuthAbuseService();

    await expect(
      service.assertLoginAllowed('user@example.com', '203.0.113.10'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when Redis returns an operational error', async () => {
    const redis = createRedisMock();
    const service = new AuthAbuseService(redis);
    (redis.eval as jest.Mock).mockRejectedValue(new Error('redis unavailable'));

    await expect(
      service.assertRefreshAllowed('203.0.113.10'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
