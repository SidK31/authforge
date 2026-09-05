# AuthForge

AuthForge is a secure authentication and authorization service for modern applications.

The goal is simple: make the security work around user accounts easier to build correctly, while keeping the system understandable and easy to integrate.

## What AuthForge will provide

1. User registration and login
2. Secure password storage
3. Email verification
4. Password reset
5. Access and refresh token handling
6. Session management
7. Role based access control
8. Fine grained permissions
9. OTP based verification where needed
10. Rate limiting and brute force protection
11. Security audit logs
12. Security focused automated tests

## Technology

The first version will use NestJS, PostgreSQL, Prisma, Redis, Docker and TypeScript.

## Project status

AuthForge is currently in the planning and architecture phase.

The implementation will be built in small, reviewed phases. Security decisions and important engineering decisions will be documented as the project grows.

## Why this project exists

Authentication looks simple from the outside, but mistakes in authentication and authorization can expose an entire application. AuthForge is being built as a practical project to explore those problems properly and provide a reusable foundation for applications that need secure user management.

## License

A license will be selected before the first public release.
