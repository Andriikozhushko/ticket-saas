# Architecture

## Primary app

`ticket-saas-web` is the primary application surface. It combines:

- public event pages
- auth and user sessions
- admin routes
- ticketier routes
- Prisma-backed data access
- order and payment processing routes

## Main boundaries

- `src/app/api/*`: transport layer and request validation
- `src/lib/auth.ts`: login, sessions, ticketier auth, auth cleanup
- `src/lib/monobank-shared-poll.ts`: payment polling and matching
- `src/lib/prisma.ts`: Prisma client bootstrap
- `prisma/schema.prisma`: DB schema source of truth

## Legacy code

The root-level `src/app.ts` Fastify server is legacy/transitional. It still contains useful reference logic, but new feature work should default to the Next.js monolith unless there is a deliberate migration task.
