# Authentication Implementation Notes

## Registration

The first authentication flow is user registration.

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
- Rejects inactive accounts.
- Returns a short-lived 15-minute JWT access token.
- Creates a server-side refresh-token session.
- Generates the refresh token from cryptographically secure random bytes.
- Stores only a SHA-256 hash of the refresh token in PostgreSQL.

Invalid credentials use the same generic error message so the API does not distinguish an unknown account from a wrong password.

## Refresh and logout

`POST /api/auth/refresh` rotates a refresh token and issues a new access token. Refresh tokens belong to a token family so that reuse of a previously rotated token can revoke the remaining family sessions.

`POST /api/auth/logout` revokes the supplied refresh-token session.

Refresh tokens are opaque and are never used as JWTs. Access tokens remain short-lived so that revocation does not depend on maintaining a server-side access-token blacklist.

## Security note

Registration and login have explicit throttles in addition to the global request limit. Email verification, stronger abuse controls, device/session management and a production-grade client storage strategy remain before authentication is considered complete.

The implementation must be verified with automated tests and a real PostgreSQL database before production release.
