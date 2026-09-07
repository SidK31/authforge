# Authentication Implementation Notes

AuthForge separates short-lived access authentication from server-side session state. The backend owns token lifecycle decisions; clients must treat tokens as secrets and follow an explicit storage strategy appropriate to their environment.

## Registration

The endpoint is:

`POST /api/auth/register`

The request accepts an email address and password.

### Rules

- Email addresses are trimmed and normalized to lowercase before lookup and storage.
- Passwords must be between 12 and 128 characters.
- Passwords are never returned in API responses.
- Passwords are stored as a derived key using Node.js scrypt with a unique random salt per password.
- Duplicate email addresses are rejected.
- The database unique constraint remains the final protection against duplicate accounts.
- The API returns only the fields needed to represent the newly created account.

## Login

The login endpoint is:

`POST /api/auth/login`

Successful login:

- Verifies the stored scrypt password hash.
- Performs password verification even when the account does not exist, using a fixed dummy hash to reduce timing differences.
- Rejects inactive accounts with the same public authentication failure.
- Returns a short-lived 15-minute JWT access token.
- Creates a server-side refresh-token session.
- Generates the refresh token from cryptographically secure random bytes.
- Stores only a SHA-256 hash of the refresh token in PostgreSQL.

Invalid credentials use the same generic error message so the API does not distinguish an unknown account from a wrong password.

## Access tokens

Access tokens are JWTs intended for short-lived API authorization.

The JWT guard requires:

- `HS256` as the accepted signing algorithm
- issuer `authforge`
- audience `authforge-api`
- a `sub` and `email` claim

The `sub` claim is not treated as proof that the account is still valid. Every protected request loads the current user from PostgreSQL and rejects missing or inactive accounts. This means deactivation takes effect without waiting for the access token to expire.

## Refresh tokens and sessions

`POST /api/auth/refresh` rotates a refresh token and issues a new access token plus refresh token.

Refresh tokens are opaque random values, not JWTs. Each session belongs to a token family. When a refresh succeeds, the old session is marked as replaced and a new session is created. Reuse of the replaced token is treated as replay and revokes the remaining active sessions in that family.

Only the SHA-256 token hash is persisted. Raw refresh tokens are not written to audit metadata or logs.

## Logout and session management

`POST /api/auth/logout` revokes the matching refresh-token session.

`GET /api/auth/sessions` returns the current user's active, unexpired sessions with safe metadata.

`DELETE /api/auth/sessions/:sessionId` revokes one session after enforcing ownership and UUID validation.

`POST /api/auth/logout-all` revokes all active sessions for the current user.

These operations are ownership-scoped so one user cannot revoke another user's session by supplying its ID.

## Email verification

`POST /api/auth/request-email-verification` creates a short-lived, single-use opaque token for eligible accounts and returns a generic response.

`POST /api/auth/verify-email` consumes the token atomically. Only the SHA-256 token hash is stored. The raw verification token is not returned by the API request endpoint; delivery of the token is intentionally separated from the lifecycle/security primitive.

## Password reset

`POST /api/auth/request-password-reset` returns a generic response regardless of whether an eligible account exists.

For an eligible account, AuthForge generates a cryptographically random opaque reset token and stores only its SHA-256 hash. `POST /api/auth/reset-password` consumes a valid, unexpired, single-use token and updates the password.

A successful password reset revokes all active sessions, forcing previously issued refresh sessions to authenticate again.

## Abuse protection

Authentication and recovery routes have route-specific throttles in addition to the global request limit. Redis-backed controls also track login abuse by IP and normalized account identifier and refresh abuse by IP.

When Redis-backed abuse protection is unavailable in production, authentication operations fail closed rather than silently operating without the intended control.

## Client and production considerations

The backend implementation is not itself a complete production identity service. Production requires secure secret configuration, HTTPS, PostgreSQL and Redis availability, database migration/backup procedures, email delivery, monitoring and trusted proxy/IP configuration.

Browser applications must choose a token-storage and transport strategy deliberately, considering XSS and CSRF risks. The GitHub Pages demo is only a local-validation demonstration and does not send or store real credentials.

The implementation is covered by automated security regression tests, but production readiness also requires real PostgreSQL/Redis integration testing and end-to-end testing of the chosen email delivery path.
