# AuthForge API

AuthForge exposes a REST API under `/api`. The endpoint set below reflects the currently implemented controller routes. API versioning will be introduced before the public contract is considered stable.

## Authentication and account lifecycle

### POST /api/auth/register

Creates a new account.

Input:

- `email`
- `password`

Returns a safe user representation. Password hashes and secrets are never returned.

### POST /api/auth/login

Authenticates an account and creates a server-side refresh-token session.

Input:

- `email`
- `password`

Returns:

- short-lived access token
- opaque refresh token
- token type
- access-token lifetime

Unknown accounts and incorrect passwords use the same public authentication error.

### POST /api/auth/refresh

Rotates a refresh token and returns a new access token and refresh token.

Refresh tokens are opaque, randomly generated values. Only their SHA-256 hashes are stored server-side. Reuse of a token that has already been rotated causes the remaining token family to be revoked rather than issuing another session.

### POST /api/auth/logout

Revokes the session represented by the supplied refresh token. The operation is idempotent from the client's perspective.

### POST /api/auth/request-email-verification

Requests an email-verification token for an account. The response is intentionally generic so account existence and verification state are not disclosed.

### POST /api/auth/verify-email

Consumes a valid, unexpired, single-use email-verification token.

Input:

- `token`

The raw token is never stored in PostgreSQL.

### POST /api/auth/request-password-reset

Requests a password-reset token. The response is intentionally generic regardless of whether the account exists or is eligible.

### POST /api/auth/reset-password

Consumes a valid, unexpired, single-use password-reset token and sets the new password. Existing active sessions are revoked after a successful reset.

Input:

- `token`
- `newPassword`

The raw reset token is never stored in PostgreSQL.

## Session management

### GET /api/auth/sessions

Returns the authenticated user's active, unexpired sessions with safe metadata such as session ID, creation time, last-use time, expiry, user-agent and IP address.

### DELETE /api/auth/sessions/:sessionId

Revokes one session belonging to the authenticated user. The session ID must be a UUID, and ownership is enforced server-side.

### POST /api/auth/logout-all

Revokes all active sessions belonging to the authenticated user.

## Users

### GET /api/users/me

Returns the current authenticated user's safe profile loaded from PostgreSQL using the verified JWT subject.

Protected requests re-check that the user still exists and is active, so deactivated or deleted identities cannot continue using an otherwise-valid access token.

## Authorization

### GET /api/roles

Lists roles and their permissions. Requires the `roles:read` permission.

There is currently no implemented `/api/permissions` endpoint; it remains a future administrative API.

Authorization metadata is enforced server-side through permission guards. Roles and permissions are seeded separately, and no default user is granted administrative access automatically.

## API security rules

1. Protected endpoints require authentication unless explicitly marked public.
2. JWT verification requires the expected algorithm, issuer and audience.
3. Protected requests resolve the current user from the JWT subject and database state.
4. Authorization is enforced on the server and does not trust client-provided roles or permissions.
5. Request bodies and route parameters are validated before application logic runs.
6. Responses contain only fields intended for the client.
7. Authentication and recovery errors avoid unnecessary account enumeration.
8. Security-sensitive endpoints have route-specific throttles in addition to the global request limit.
9. Redis-backed authentication abuse controls fail closed in production when the protection dependency is unavailable.
10. Internal exceptions and stack traces are never intentionally exposed as public API data.

## Production limitations

The current repository provides the security primitives and API implementation, but it is not yet a production-hosted authentication service. Before a public deployment, configure production secrets, HTTPS, PostgreSQL, Redis, migrations/backups, email delivery, monitoring/alerting and trusted proxy/IP handling. See `docs/PRE-DEPLOYMENT-SECURITY-CHECKLIST.md` for release gates.

Browser clients also need an explicit token-storage strategy. The GitHub Pages demo currently validates input locally and does not send or persist real credentials; it is not a production authentication client.
