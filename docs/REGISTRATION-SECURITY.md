# Registration security

Registration is treated as an attack surface, not only as a form submission.

## Controls in the current implementation

- Email input is trimmed and normalized to lowercase before lookup and persistence.
- Passwords are validated at the API boundary before the service runs.
- Passwords are hashed with a unique random salt using Node.js scrypt.
- The password hash is never included in the registration response.
- PostgreSQL keeps email unique as a database constraint.
- A database uniqueness race is translated into a safe conflict response.
- Unexpected request properties are rejected by the global validation pipe.
- Global request throttling is enabled as a baseline control.
- Registration and login have an explicit 5 requests/minute throttle in addition to the global limit.
- Login returns the same generic authentication error for unknown and inactive accounts versus incorrect passwords.
- Access tokens are short-lived JWTs and are signed with a secret loaded from environment configuration.

## Remaining work

Registration still needs dedicated abuse controls, email verification and end to end tests against a real PostgreSQL instance.

The final public API should also be reviewed for account enumeration and rate limit bypass before release.

Login still needs refresh-token sessions, rotation, reuse detection and logout/revocation before authentication is considered complete.
