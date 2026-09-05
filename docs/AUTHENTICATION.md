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

## Security note

Registration is intentionally small at this stage. Email verification, abuse controls specific to registration, and session issuance will be added in later authentication phases.

The implementation must be verified with automated tests and a real database before it is considered complete.
