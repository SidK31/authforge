# AuthForge Deployment

## Deployment target

AuthForge is a modular NestJS REST API. The first hosted deployment should keep the architecture simple:

```text
Public HTTPS
    |
    v
NestJS API container
    |---- PostgreSQL
    `---- Redis
```

The API should run as a single container initially. PostgreSQL is the system of record and Redis is used for temporary authentication-abuse state. No application state should depend on the container filesystem.

A managed PostgreSQL service and managed Redis service are preferred for the first hosted deployment. The API can then be deployed on a container platform that supports environment variables, HTTPS, health checks, logs, and rolling/restart behavior.

## Required environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test`, or `production` |
| `PORT` | No | HTTP port; defaults to `3000` |
| `DATABASE_URL` | Yes in hosted runtime | PostgreSQL connection URL |
| `REDIS_URL` | Yes in production | Redis connection URL for authentication abuse controls |
| `JWT_SECRET` | Yes | Secret used to sign and verify access JWTs; minimum 32 characters |

Production secrets must be supplied through the hosting platform's secret/environment-variable mechanism. They must not be committed to Git, baked into the image, or written to application logs.

`DATABASE_URL` and `REDIS_URL` should use encrypted/TLS-capable service connections when supported by the provider. Database credentials should be dedicated to the application and granted only the permissions required by the application.

## Database migration procedure

Production deployments must use Prisma's deploy command against the existing database:

```text
npx prisma migrate deploy
```

Do **not** run `prisma migrate dev` against production. Migration files committed under `prisma/migrations` are the source of truth for schema changes.

Recommended release sequence:

1. Provision PostgreSQL.
2. Configure `DATABASE_URL`.
3. Configure `JWT_SECRET` and `REDIS_URL`.
4. Build the immutable application image.
5. Run `npx prisma migrate deploy` as a release/deploy step.
6. Start the API container.
7. Verify the health endpoint.
8. Verify logs contain no startup errors or secret material.
9. Run a small authenticated smoke test before exposing the deployment as the public demo backend.

Migrations should be reviewed before deployment and backed up according to the database provider's production policy.

## Startup behavior

The API connects to PostgreSQL during NestJS module initialization. If the database cannot be reached, startup should fail rather than serving a partially functional authentication service.

The current public endpoint is:

```text
GET /api/health
```

It is intentionally lightweight and does not currently prove PostgreSQL or Redis readiness. Therefore it can be used as a basic process/liveness check, but it must **not** be treated as a complete dependency readiness check until a dependency-aware readiness endpoint is implemented.

## Redis requirement

Redis is part of the production authentication security boundary because login and refresh abuse controls use Redis-backed state. In production, missing or unavailable Redis protection fails closed for those protected flows rather than silently disabling the controls.

Redis should be provisioned as a managed service where possible, with authentication/TLS configured according to the provider's recommendations.

## Docker

The production image uses a multi-stage Node 24 Alpine build:

- builder stage installs the lockfile-defined dependency tree with `npm ci` and builds the NestJS application;
- runner stage installs production dependencies only with `npm ci --omit=dev`;
- Prisma runtime packages/generated client are copied into the runner image;
- the container starts with `node dist/main.js`.

The image does not contain application secrets. Secrets belong in runtime configuration.

## Reverse proxy and HTTPS

The API should be exposed through the hosting provider's HTTPS endpoint or a trusted reverse proxy. TLS should terminate at that boundary. The proxy configuration must preserve the client's real IP only when the application explicitly trusts that proxy configuration; otherwise rate limiting and audit context can use an attacker-controlled forwarding header.

CORS should be restricted to the actual browser clients when a browser frontend is connected. Do not deploy with a wildcard production CORS policy.

## Production readiness boundary

A successful container deployment does not by itself make AuthForge production-ready.

Before calling the system production-ready, complete the remaining operational controls documented in `docs/PRE-DEPLOYMENT-SECURITY-CHECKLIST.md`, especially:

- production secrets and HTTPS;
- PostgreSQL backups and restore verification;
- Redis availability;
- production email delivery for account recovery;
- monitoring, error tracking and security alerting;
- dependency-aware readiness checks;
- final browser-client token storage/CORS policy;
- an end-to-end authentication smoke test against the hosted services.
