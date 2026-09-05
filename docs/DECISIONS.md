# AuthForge Architecture Decisions

## ADR 001: Use a modular monolith for V1

Decision: Build AuthForge as one NestJS application with clearly separated modules.

Reason: The first goal is correctness, security and maintainability. A modular monolith gives us clear boundaries without the operational cost of multiple services.

## ADR 002: PostgreSQL is the source of truth

Decision: Store identity, authorization, sessions and audit records in PostgreSQL.

Reason: These records need durable and consistent persistence. Redis will only handle temporary security state.

## ADR 003: Use opaque refresh tokens

Decision: Access tokens may be JWTs, but refresh tokens will be random opaque values with only their hashes stored server side.

Reason: Refresh tokens need server side revocation and rotation. Keeping their plaintext out of the database reduces exposure if the database is leaked.

## ADR 004: Enforce authorization on the server

Decision: Every protected operation makes its authorization decision on the backend.

Reason: Client side checks improve user experience but cannot provide a security boundary.

## ADR 005: Delay microservices and extra infrastructure

Decision: Do not introduce microservices, Kafka, Kubernetes or other distributed infrastructure in V1.

Reason: Complexity should be justified by a real requirement. The initial product can be secure and reliable without it.
