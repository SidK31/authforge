# AuthForge Roadmap

## Phase 1: Product and architecture

Status: Complete

1. Define the problem
2. Define the target users
3. Define the version 1 scope
4. Define what is out of scope
5. Establish security first principles

## Phase 2: System design

Status: Complete

1. Choose the application architecture
2. Design the module structure
3. Design the database direction
4. Design authentication and session flows
5. Design authorization and permissions
6. Define the API direction
7. Create the threat model
8. Record key architecture decisions

## Phase 3: Foundation

Status: In progress

1. Initialize the NestJS application
2. Configure TypeScript and code quality tools
3. Add PostgreSQL and Prisma
4. Add environment configuration
5. Add validation and error handling
6. Add Docker development setup
7. Add the initial test setup

## Phase 4: Authentication

Status: In progress

1. Registration endpoint and password hashing
2. Login
3. Access token handling
4. Refresh token rotation
5. Logout and session revocation
6. Password reset
7. Email verification
8. Authentication abuse protection

## Phase 5: Authorization

Status: Pending

Build roles, permissions and server side authorization checks.

## Phase 6: Security controls

Status: Pending

Add rate limiting, brute force protection, audit events and other security controls identified during the threat model.

## Phase 7: Testing and security review

Status: Pending

Test normal flows, failure cases and abuse cases. Document vulnerabilities found during testing and the fixes applied.

## Phase 8: Developer experience

Status: Pending

Complete API documentation, local setup documentation, examples and integration guidance.

## Phase 9: Deployment

Status: Pending

Prepare production configuration, CI checks, container deployment and operational documentation.

## Phase 10: Public release

Status: Pending

Review the complete project, choose the open source license, publish the first release and collect developer feedback.
