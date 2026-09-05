# AuthForge Database Design

PostgreSQL is the source of truth for persistent identity and security state.

## User

Stores the account identity and account state.

Main fields:

- id
- email
- password_hash
- email_verified_at
- status
- failed_login_count
- locked_until
- created_at
- updated_at

Email will have a unique constraint. Password hashes are never returned through API responses.

## Role

Defines a named application role such as user, support or admin.

Main fields:

- id
- name
- description
- created_at
- updated_at

Role name will be unique.

## Permission

Defines one specific capability such as users.read or users.update.

Main fields:

- id
- key
- description
- created_at

Permission key will be unique.

## UserRole

Connects users to roles.

A user can have multiple roles and a role can belong to multiple users.

## RolePermission

Connects roles to permissions.

A role can contain multiple permissions and a permission can belong to multiple roles.

## Session

Represents a login session and refresh token family.

Main fields:

- id
- user_id
- token_hash
- family_id
- expires_at
- revoked_at
- created_at
- last_used_at
- ip_address
- user_agent

Only a hash of the refresh token is stored.

The family_id is used to detect reuse of an already rotated refresh token and revoke the affected token family.

## AuditEvent

Stores security relevant events.

Main fields:

- id
- user_id
- event_type
- success
- ip_address
- user_agent
- metadata
- created_at

Metadata must never contain passwords, raw tokens, OTP values or other secrets.

## Relationships

```text
User
 |
 +---- UserRole ---- Role ---- RolePermission ---- Permission
 |
 +---- Session
 |
 +---- AuditEvent
```

## Important constraints

1. User email must be unique.
2. Role name must be unique.
3. Permission key must be unique.
4. User role pairs must be unique.
5. Role permission pairs must be unique.
6. Session token hashes must be unique.
7. Foreign keys must prevent orphaned security records.
8. Timestamps should be stored consistently in UTC.
9. Sensitive values must never be stored in plaintext when a hash is sufficient.

The exact Prisma schema will be created during the foundation phase after these relationships are reviewed against the implementation requirements.
