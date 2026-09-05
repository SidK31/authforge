# AuthForge Architecture

## Decision

AuthForge V1 will use a modular monolith built with NestJS.

The application will expose a REST API and use PostgreSQL as the source of truth for identity, sessions, roles, permissions and audit records. Redis will be used for short lived security state such as rate limit counters and temporary login protection.

This keeps the first version easy to run, test and understand. We can split services later if real usage creates a reason to do so.

## High level design

```text
Client application
       |
       v
   REST API
       |
       v
     NestJS
       |
  +----+-------------------+
  |    |    |    |    |    |
 Auth Users Roles Sessions Audit
  |    |    |    |    |    |
  +----+----+----+----+----+
           |
           v
       PostgreSQL

Security state and rate limits
           |
           v
          Redis
```

## Core modules

### Auth

Owns registration, login, logout, password verification, token issuance, refresh token rotation, password reset and email verification workflows.

### Users

Owns user identity data and account state such as active, locked and verified status.

### Sessions

Owns refresh token sessions, token families, revocation and session metadata.

### Roles and permissions

Owns roles, permissions and the relationships used by server side authorization checks.

### Audit

Records security sensitive events such as login success, login failure, logout, password changes, session revocation and authorization failures where useful.

### Security

Contains cross cutting controls such as request validation, throttling, brute force protection and security related helpers.

## Request flow

A request enters through a controller, passes validation and authentication guards where required, reaches the application service, and then uses repositories or Prisma for persistence.

Authorization must be enforced on the server. Client supplied role or permission information is never treated as proof of access.

## Token model

Access tokens will be short lived JWTs containing only the claims needed by the API.

Refresh tokens will be cryptographically random opaque values. Only a hash of a refresh token will be stored in PostgreSQL. Refresh token rotation will issue a new token and invalidate the previous token.

A refresh token family will allow reuse detection and family revocation if a rotated token is presented again.

## Data ownership

PostgreSQL is authoritative for account, authorization and session state.

Redis is not the source of truth for identity or permissions. Redis data may expire or be cleared without losing the account model.

## Error handling

External API responses will use a consistent error shape and will avoid exposing internal stack traces, database errors, token values, password state or other sensitive details.

## Technology choices

- TypeScript
- NestJS
- PostgreSQL
- Prisma
- Redis
- Docker
- Jest
- Swagger/OpenAPI

## What we are deliberately not doing yet

AuthForge V1 is not a microservice platform. We will not add Kafka, Kubernetes, GraphQL, multi region infrastructure or a frontend until the core authentication service has a clear reason to need them.
