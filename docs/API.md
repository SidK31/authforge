# AuthForge API Plan

The current API is REST based under `/api`. Versioning will be introduced before the public API contract is considered stable.

## Authentication

### POST /api/auth/register

Creates a new user account.

Input:

- email
- password

Returns a safe user representation. It does not return password hashes or secrets.

### POST /api/auth/login

Authenticates a user and creates a server-side refresh-token session.

Input:

- email
- password

Returns:

- short-lived access token
- opaque refresh token
- token type
- access-token lifetime

### POST /api/auth/refresh

Rotates a refresh token and returns a new access token and refresh token.

A previously rotated refresh token triggers refresh-token family revocation rather than being accepted as a valid session continuation.

### POST /api/auth/logout

Revokes the supplied refresh-token session.

## Planned authentication endpoints

### POST /api/auth/logout-all

Revokes all active sessions for the authenticated user.

## Users

### GET /api/users/me

Returns the authenticated user's safe profile from the verified access-token identity.

### PATCH /api/users/me

Updates allowed profile fields.

Sensitive account changes will use dedicated flows rather than allowing arbitrary fields to be updated.

## Authorization

### GET /api/roles

Lists roles and their permissions. Requires the `roles:read` permission.

### GET /api/permissions

Planned administrative endpoint for listing permissions.

Authorization metadata is enforced server-side through permission guards. Roles and permissions are seeded separately; no default user is granted administrative access automatically.

## API rules

1. Protected endpoints require authentication unless explicitly marked public.
2. Authorization is enforced on the server.
3. Request bodies are validated before application logic runs.
4. Responses contain only fields intended for the client.
5. Authentication errors should avoid unnecessary account enumeration.
6. Security-sensitive endpoints are rate limited.
7. Error responses use a consistent public format.
8. Internal exceptions and stack traces are never returned to clients.
