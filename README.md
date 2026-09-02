# DentivoHQ

DentivoHQ is a multi-tenant dental appointment SaaS built for Cloudflare and Neon PostgreSQL.

## Workspace

```text
apps/
  landing/     Astro marketing site
  api/         Hono API on Cloudflare Workers
  dashboard/   Clinic team dashboard and isolated public booking route
  console/     PLATFORM_ADMIN-only internal console
packages/
  auth/        Better Auth, clinic membership, and permissions
  config/      Runtime environment validation and shared configuration
  db/          PostgreSQL migrations and tenant-scoped repositories
  ui/          Shared Tailwind CSS and shadcn-style components
  validation/  Shared Zod request contracts
tooling/       Vitest and Playwright configuration
```

## Local setup

Requirements: Node.js 22+, pnpm 11+, and Docker for local PostgreSQL.

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
pnpm db:migrate
pnpm dev
```

For the Worker, copy server-only values into `apps/api/.dev.vars`. Copy only `VITE_API_URL` into dashboard and console environments, and `PUBLIC_*` values into the landing environment.

The production Neon connection should use a pooled connection string. The application Worker uses the Neon serverless HTTP driver; the migration runner uses standard PostgreSQL so schema management remains provider-portable.

## Authentication and authorization

Better Auth is mounted at `/api/auth` and supports email/password, email verification, password reset, and Google OAuth when its credentials are present. Configure the Google callback as `{BETTER_AUTH_URL}/api/auth/callback/google`.

Every clinic API request authenticates the session, validates clinic context, resolves active membership, and enforces a granular permission. A client-provided clinic identifier is never treated as authorization.

## Database and migrations

Migrations are append-only SQL files under `packages/db/migrations`.

```bash
pnpm db:migrate
pnpm db:check
```

The appointment schema uses a PostgreSQL exclusion constraint over clinic, dentist, and UTC time range. Availability is computed from location timezone, schedules, exceptions, time off, service duration, and active appointments.

## API conventions

Business routes use `/api/v1`. Success responses use `{ "data": ... }`, paginated responses add `meta`, and failures use `{ "error": { "code", "message" } }`.

Key routes include clinic onboarding, locations, invitations, dentists, services, schedules, patients, appointments, availability, private files, isolated public booking, and a platform-administrator overview.

## Cloudflare resources

The Worker uses environment secrets, a private `UPLOADS` R2 binding, a public-booking rate limiter, and sampled observability. Create the configured preview and production buckets before deployment:

```bash
pnpm --filter @dentivohq/api exec wrangler r2 bucket create dentivohq-uploads-preview
pnpm --filter @dentivohq/api exec wrangler r2 bucket create dentivohq-uploads
```

Set secrets interactively with `wrangler secret put`; never add them to `wrangler.jsonc`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

CI performs a frozen pnpm install, applies migrations to PostgreSQL, and runs lint, type checks, unit tests, integration tests, and builds.

## Deployment

- `apps/landing`, `apps/dashboard`, and `apps/console` build to `dist` for Cloudflare Pages.
- `apps/api` deploys to Cloudflare Workers with `pnpm --filter @dentivohq/api deploy`.
- All application URLs are environment-driven. No production domain is assumed until the owner confirms one.
