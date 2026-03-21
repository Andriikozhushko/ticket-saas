# `ticket-saas-web`

Next.js monolith for the ticketing product. This app currently contains the public site, admin panel, ticketier panel, auth flow, order management, and the main Prisma-backed backend logic.

## Local development

1. Start Postgres from the repo root:

```bash
docker compose -f docker-compose.prod.yml up -d db
```

2. Create `ticket-saas-web/.env` from `.env.example`.

3. Apply migrations:

```bash
cd ticket-saas-web
npm.cmd run prisma:migrate:deploy
```

4. Start the app:

```bash
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful scripts

- `npm.cmd run dev` - start Next.js dev server
- `npm.cmd run typecheck` - run TypeScript without emitting files
- `npm.cmd run lint` - run ESLint
- `npm.cmd run test` - run Vitest
- `npm.cmd run db:up` - start Postgres via Docker Compose
- `npm.cmd run db:down` - stop Postgres
- `npm.cmd run prisma:migrate:deploy` - apply Prisma migrations

## Dev auth behavior

- In non-production environments Turnstile verification is bypassed.
- If `BREVO_API_KEY` is missing, login codes are logged to the dev server console instead of being emailed.
- `GET /api/health` reports database and integration readiness for local debugging.

## Architecture notes

- `src/app/api` contains the HTTP routes.
- `src/lib` contains shared auth, payment, validation, and infrastructure helpers.
- `prisma/schema.prisma` is the database source of truth for the Next.js app.
- The root-level Fastify server is legacy/transitional; prefer the Next.js monolith for new work unless intentionally touching the legacy stack.
