# AuthForge Threat Model

This document describes the main security risks considered for AuthForge V1.

## Assets we protect

- User accounts
- Password hashes
- Access and refresh tokens
- Active sessions
- Roles and permissions
- Password reset and verification state
- Audit records
- Application configuration and secrets

## Main threats

### Credential attacks

An attacker may guess passwords or repeatedly submit stolen credentials.

Controls: password hashing, rate limiting, brute force protection, generic authentication errors and account protection.

### Token theft and replay

An attacker may obtain an access or refresh token and attempt to use it.

Controls: short lived access tokens, refresh token rotation, hashed refresh token storage, token family tracking and revocation.

### Broken authorization

An authenticated user may attempt to access another user's resources or administrative functionality.

Controls: server side authorization checks, roles and permissions, resource ownership checks and authorization tests.

### Account recovery abuse

An attacker may abuse password reset or verification flows to take over an account or enumerate users.

Controls: single use recovery tokens, expiry, rate limiting, generic responses and security focused tests.

### Injection and malformed input

An attacker may send unexpected or malicious input to API endpoints.

Controls: DTO validation, constrained database queries through Prisma and negative tests for malformed input.

### Abuse of public endpoints

Attackers may send high request volumes to authentication endpoints.

Controls: rate limiting, brute force protection and monitoring through audit events.

### Information disclosure

Errors or responses may reveal whether accounts exist, internal implementation details or sensitive security state.

Controls: consistent public errors, response filtering and security tests.

### Compromised application secret

If a signing or encryption secret is exposed, an attacker may compromise security controls.

Controls: environment based configuration, secret validation at startup, no secrets in source control and documented secret rotation expectations.

## Security boundary

The client is untrusted. Any role, permission, user identifier or security decision supplied by the client must be treated as untrusted input.

The API and database form the trusted application boundary. Authorization decisions are made server side.

## Security testing approach

Each security sensitive feature should have tests for both the expected flow and the most important abuse case. Findings discovered during testing will be recorded with their impact, reproduction conditions and remediation.
