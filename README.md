# Delivery Buddy API

![CI](https://github.com/<your-username>/<your-repo>/actions/workflows/ci.yml/badge.svg)

Backend API for the Delivery Buddy courier app (Backend API Internship Assessment).

Stack: **NestJS** + **PostgreSQL** (via **Prisma**) + **Redis** (caching layer) + **Swagger/OpenAPI** + **Jest/Supertest**.

## Features

- JWT auth (signup, login, refresh, logout)
- Courier onboarding & profile
- Shifts (start/stop/history)
- Wallet & transactions
- Orders, order tracking (route/ETA), order status updates
- Order-scoped chat messages
- Notifications
- Courier settings (fuel, billing, location, notifications) + support info
- **Redis caching** on read-heavy/expensive endpoints to avoid redundant DB and third-party API calls (see [Caching strategy](#caching-strategy))
- Swagger docs at `/docs`

## Project structure

```
prisma/
  schema.prisma        # data model
  seed.ts               # sample data
src/
  auth/                 # signup, login, refresh, JWT strategy/guard
  couriers/             # onboarding profile, /me
  teams/                # onboarding team list (cached)
  shifts/                # start/stop/current/history
  wallet/                # balance, transactions, withdraw
  orders/                # queue, current, detail, status, route (cached)
  messages/              # order-scoped chat
  notifications/
  settings/              # fuel/billing/location/notifications + support
  prisma/                # PrismaService (global module)
  redis/                 # RedisService cache-aside helper (global module)
  common/                # guards, decorators, exception filter
test/
  app.e2e-spec.ts        # e2e tests with Prisma/Redis mocked
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use the provided `docker-compose.yml`)
- Redis 6+ (or use the provided `docker-compose.yml`)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in secrets
cp .env.example .env

# 3. Start Postgres + Redis locally (optional, if you don't have them running already)
docker compose up -d

# 4. Generate the Prisma client
npx prisma generate

# 5. Run migrations (creates tables from prisma/schema.prisma)
npx prisma migrate dev --name init

# 6. (Optional) seed sample data
npm run prisma:seed
```

> **Note:** `prisma generate` and `prisma migrate` download a small schema-engine
> binary from Prisma's CDN (`binaries.prisma.sh`) on first run. Make sure that
> host isn't blocked by any firewall/proxy in your environment (this only
> came up in the sandbox used to build this project — it will not affect a
> normal machine, CI runner, or the deploy target).

## Running

```bash
npm run start:dev     # watch mode, http://localhost:3000/api/v1
npm run start         # standard
npm run start:prod    # after `npm run build`
```

Swagger UI: `http://localhost:3000/docs`
Health check: `http://localhost:3000/health`

## Testing

```bash
npm test               # unit tests (auth, wallet, redis cache-aside logic)
npm run test:e2e       # e2e tests (Prisma & Redis mocked, validation + auth flows)
npm run test:cov       # coverage report
```

Unit tests cover:
- Signup conflict / success paths
- Login invalid-credential handling
- Wallet withdrawal validation (insufficient balance) and cache invalidation
- Redis cache-aside hit/miss behavior

E2e tests cover:
- Health check
- Request validation (400 on invalid email / short password)
- Auth failure responses (401 on unknown login)
- Route guarding (401 on protected routes without a token)

## Caching strategy

Redis is used as a **cache-aside** layer (`RedisService.getOrSet`) to avoid
redundant database reads and, more importantly, redundant calls to
third-party services. Cached endpoints/keys:

| Data | Key pattern | TTL | Why |
|---|---|---|---|
| Teams list | `teams:all` | 5 min | Rarely changes, read on every onboarding load |
| Courier profile | `courier:{id}:profile` | 2 min | Read on nearly every screen |
| Wallet balance | `wallet:{courierId}` | 30s | Frequently polled by the dashboard/wallet screen |
| Active shift stats | `shift:{courierId}:current` | 15s | Polled while a shift is active |
| Order route/ETA | `order:{id}:route` | 20s | Stands in for a third-party maps/routing API call — this is the main "avoid redundant third-party calls" case |
| Order chat thread | `order:{id}:messages` | 30s | Reduces DB load on chat polling |
| Notifications | `notifications:{id}:{filter}` | 20s | Invalidated (by prefix) on mark-as-read |
| Courier settings | `courier:{id}:settings` | 2 min | Simple preference reads |
| Support info | `support:info` | 1 hr | Static content |

All cache entries are explicitly invalidated (`del` / `delByPrefix`) on the
corresponding write endpoint, so a courier never sees stale data after an
action they just took (e.g. withdrawing funds invalidates the wallet key
immediately).

## Deployment

### Option A — Vercel (serverless)

This repo includes `api/index.ts` (a serverless entry point via
`@vendia/serverless-express`) and `vercel.json`, so it deploys directly:

```bash
npm install -g vercel
vercel
```

Then in the Vercel dashboard, set these environment variables (Project →
Settings → Environment Variables), same keys as `.env.example`:
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`,
`JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`.

Two things to know about running this stack on Vercel specifically:

1. **Postgres connection pooling is required.** Serverless functions can
   spin up many concurrent instances, each opening its own DB connection —
   a normal Postgres connection string will exhaust your connection limit
   quickly. Use your provider's **pooled** connection string:
   - **Neon**: use the `-pooler` endpoint hostname it gives you (or append
     `?pgbouncer=true`), not the direct one.
   - **Supabase**: use the "Connection pooling" string (port `6543`), not
     the direct one (port `5432`).

2. **`ioredis` opens persistent TCP connections**, which don't behave well
   across cold starts on serverless. It'll still work, but for a smoother
   fit consider swapping `RedisService` to
   [Upstash Redis](https://upstash.com) (HTTP-based, built for serverless,
   has a generous free tier) — the `getOrSet`/`get`/`set`/`del` interface in
   `src/redis/redis.service.ts` would only need its internals swapped, not
   its call sites.

### Option B — Railway / Render (traditional long-running server)

These fit this stack more naturally, since Prisma + ioredis were built
around a persistent server, not a serverless one. Uses the standard
`main.ts` entry point (`app.listen()`), no adapter needed.

1. Provision a PostgreSQL and a Redis instance (both platforms offer these
   as one-click add-ons).
2. Set environment variables from `.env.example` in the platform's config/secrets UI.
3. Build command: `npm install && npx prisma generate && npm run build`
4. Release/pre-deploy command: `npx prisma migrate deploy`
5. Start command: `npm run start:prod`
6. Confirm `GET /health` and `GET /docs` respond, then update the line below
   with the live base URL.

**Live API base URL:** _add after deploying, e.g. `https://delivery-buddy-api.up.railway.app/api/v1`_

## API documentation

- Swagger/OpenAPI: served at `/docs` when the app is running (also exportable as JSON via `/docs-json`).
- Requirements specification (endpoint list with request/response examples): see the separate `Delivery_Buddy_API_Requirements_Spec.docx`.
- ERD: generate from `prisma/schema.prisma` via `npx prisma-erd-generator` or paste the DBML equivalent into dbdiagram.io.
