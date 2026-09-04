# DentivoHQ recovery and performance drills

Run these drills before broad clinic onboarding and after material booking, notification, storage, or migration changes. Use synthetic data only.

## Automated drill

The **Operations drill** GitHub Actions workflow starts PostgreSQL 17, applies all migrations, and executes:

- 50 concurrent successful bookings through `packages/db/src/booking-load.ts`, with a p95 threshold of 2 seconds and minimum throughput of 5 requests/second
- 10 simultaneous requests for one dentist slot, requiring exactly one success
- notification lease reclaim and five-attempt terminal-failure behavior
- paginated R2 orphan discovery and deletion behavior
- PostgreSQL custom-format backup, clean restore, and migration/clinic count comparison

Local execution requires Docker Desktop and runs against the disposable database in `docker-compose.yml`:

```bash
docker compose up -d --wait postgres
pnpm db:migrate
pnpm test:operations
pnpm exec vitest run --config tooling/vitest.integration.config.ts packages/db/src/notification-leases.integration.test.ts
pnpm exec vitest run apps/api/src/services/files.test.ts
pnpm verify:postgres-recovery
```

Override `BOOKING_LOAD_COUNT`, `BOOKING_LOAD_MAX_P95_MS`, or `BOOKING_LOAD_MIN_REQUESTS_PER_SECOND` to test a proposed operating envelope. A threshold failure blocks readiness; do not weaken thresholds without recording measured evidence and a capacity reason.

For a real preview drill, retain the workflow run URL, commit SHA, load summary, notification result, backup/restore summary, and Worker reconciliation logs. Never retain patient payloads, email addresses, database URLs, or object contents in evidence.
