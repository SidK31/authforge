# AuthForge API Plan

The first API will be REST based and versioned under /api/v1.

## Authentication

### POST /api/v1/auth/register

Creates a new user account.

Input:

- email
- password

Returns a safe user representation and the result of the verification workflow. It must not return password hashes or secrets.

### POST /api/v1/auth/login

Authenticates a user and creates a session.

Input:

- email
- password

Returns an access token and refresh token through the security model defined by the implementation.

### POST /api/v1/auth/refresh

Rotates a refresh token and returns a new access token and refresh token.

A previously rotated refresh token must not be accepted as a valid session continuation.

### POST /api/v1/auth/logout

Revokes the current session.

### POST /api/v1/auth/logout-all

Revokes all active sessions for the authenticated user.

## Users

### GET /api/v1/users/me

Returns the authenticated user's safe profile.

### PATCH /api/v1/users/me

Updates allowed profile fields.

Sensitive account changes will use dedicated flows rather than allowing arbitrary fields to be updated.

## Authorization

### GET /api/v1/roles

Administrative endpoint for listing roles.

### GET /api/v1/permissions

Administrative endpoint for listing permissions.

The exact administrative routes will be finalized when the authorization module is implemented.

## API rules

1. Protected endpoints require authentication unless explicitly marked public.
2. Authorization is enforced on the server.
3. Request bodies are validated before application logic runs.
4. Responses contain only fields intended for the client.
5. Authentication errors should avoid unnecessary account enumeration.
6. Security sensitive endpoints are rate limited.
7. Error responses use a consistent public format.
8. Internal exceptions and stack traces are never returned to clients.
