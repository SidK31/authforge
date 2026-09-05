# AuthForge

AuthForge is a secure authentication and authorization service for modern applications.

The goal is simple: make the security work around user accounts easier to build correctly, while keeping the system understandable and easy to integrate.

## Live demo

The current frontend demo is deployed with GitHub Pages.

Live site: https://sidk31.github.io/authforge/

The registration form currently validates input in the browser. It does not send or store credentials. The real API connection will be added after the backend deployment is ready.

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

AuthForge is being built in small, reviewed phases. Product requirements, system architecture, database direction, API direction and the first registration implementation are in place. The GitHub Pages demo provides a visible frontend while the backend continues to be developed.

## Documentation

The `docs` directory contains the product scope, architecture, database design, API direction, threat model, security decisions and development roadmap.

## Why this project exists

Authentication looks simple from the outside, but mistakes in authentication and authorization can expose an entire application. AuthForge is being built as a practical project to explore those problems properly and provide a reusable foundation for applications that need secure user management.

## License

A license will be selected before the first public release.
