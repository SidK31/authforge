# AuthForge Pre-Deployment Security Checklist

This checklist is the release gate for the first hosted backend deployment.

## 1. Authentication

- [x] Passwords are hashed with Node.js `scrypt` using a per-password random salt.
- [x] Login uses a generic authentication error for unknown users and wrong passwords.
- [x] Unknown-user login still performs password verification against a fixed dummy hash.
- [x] Access JWTs are short-lived (15 minutes).
- [x] JWT verification restricts algorithm, issuer and audience.
- [x] Protected requests resolve the user from the verified JWT subject and current database state.
- [x] Inactive users cannot continue using previously issued access tokens.

## 2. Refresh tokens and sessions

- [x] Refresh tokens are cryptographically random opaque values.
- [x] Only refresh-token hashes are stored in PostgreSQL.
- [x] Refresh tokens rotate on use.
- [x] Reuse of a rotated token revokes the remaining token family.
- [x] Concurrent refresh races are covered by tests.
- [x] Users can list their active sessions.
- [x] Session revocation is scoped to the authenticated user.
- [x] Logout-all revokes all active sessions for that user.

## 3. Account recovery

- [x] Verification and password-reset tokens are cryptographically random.
- [x] Only token hashes are persisted.
- [x] Recovery tokens are single-use and expire.
- [x] Recovery request endpoints return generic responses.
- [x] Recovery endpoints are rate limited.
- [x] Password reset revokes active sessions.
- [ ] Production email delivery provider is configured.

## 4. Authorization

- [x] Roles and permissions are enforced server-side.
- [x] Protected authorization checks do not trust client-provided roles.
- [x] Permission bypass and cross-user ownership cases have regression tests.
- [ ] Final hosted API contract is reviewed before public release.

## 5. Abuse protection

- [x] Global request throttling is enabled.
- [x] Authentication endpoints have stricter route-level limits.
- [x] Redis-backed login and refresh abuse controls are implemented.
- [x] Redis keys use hashed security dimensions rather than raw email addresses.
- [x] Redis operational failures fail closed for production authentication abuse controls.
- [ ] Production Redis availability, TLS and network access are verified.

## 6. Input and response security

- [x] Global validation uses `whitelist` and `forbidNonWhitelisted`.
- [x] Recovery token DTOs constrain length and character set.
- [x] UUID path parameters use strict UUID parsing where applicable.
- [x] Authentication responses do not expose password hashes or raw refresh/recovery tokens.
- [x] Security audit metadata does not contain passwords or raw tokens.
- [ ] Production reverse-proxy/body-size limits are configured.

## 7. HTTP and secrets

- [x] Helmet security headers are enabled.
- [x] JWT secret is loaded from environment configuration and requires at least 32 characters.
- [x] No application secrets are intentionally committed to source control.
- [x] Example environment values are placeholders only.
- [ ] Production JWT secret is generated from a cryptographically secure source and stored in the hosting provider's secret manager.
- [ ] Production database credentials are stored as deployment secrets.
- [ ] HTTPS is enforced by the hosting/reverse-proxy layer.
- [ ] Trusted proxy configuration is reviewed before relying on request IP addresses for abuse controls.

## 8. Database and deployment

- [x] Prisma migrations are committed.
- [x] CI uses deterministic `npm ci` installation.
- [x] Production Docker builds use `npm ci` rather than an unconstrained install.
- [x] Dependency audit output is captured in CI.
- [x] Current CI formatting, lint, test and build gates are green.
- [ ] Production migrations are run through a controlled release process.
- [ ] Database backups and restore procedure are verified.
- [ ] Application logs are reviewed to ensure secrets and credentials are not emitted.

## 9. Monitoring and incident response

- [x] Security-sensitive authentication events are recorded in the audit table.
- [ ] Error monitoring is configured for the hosted service.
- [ ] Alerts exist for authentication abuse, repeated failures and infrastructure failures.
- [ ] A secret-rotation procedure is documented.
- [ ] A session-revocation procedure is documented for suspected account compromise.

## Release decision

AuthForge is **not production-ready solely because the code and CI are green**. The remaining unchecked items are deployment and operational controls that must be completed against the actual hosting environment.

### Priority order

1. **P0:** Configure production secrets, HTTPS, PostgreSQL and Redis.
2. **P0:** Verify database backups/migrations and application startup in the hosted environment.
3. **P1:** Configure email delivery and complete end-to-end recovery testing.
4. **P1:** Configure monitoring, error tracking and security alerts.
5. **P1:** Review proxy/IP handling and production request limits.
6. **P2:** Finalize public API contract and release documentation.
