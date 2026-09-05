# Redis Authentication Abuse Controls

AuthForge keeps the existing NestJS throttler as a baseline request limit and adds Redis-backed controls specifically for authentication endpoints.

## Login

Login attempts are counted in two dimensions:

- source IP address
- normalized email address

The Redis keys contain SHA-256 digests of those dimensions, not the raw IP address or email. The counter is limited to 5 attempts per 5-minute window. A successful login clears both counters.

## Refresh

Refresh attempts are limited by source IP to 30 attempts per minute. The refresh token itself is never stored in Redis.

## Atomic counters

Counters use a small Redis Lua script that increments the counter and sets the expiry when the key is first created. Redis executes the script atomically, avoiding a race between incrementing and setting the expiry.

## Redis failure behavior

Authentication abuse protection is a security dependency in production. If `REDIS_URL` is missing in production, or Redis cannot perform the security check, the authentication request fails closed with `503 Service Unavailable` rather than silently disabling the protection.

In development and test environments, Redis is optional so the application and unit tests remain usable without a Redis server.

## Required production configuration

Set `REDIS_URL` to the application's Redis connection URL before deploying the authentication service to production.
