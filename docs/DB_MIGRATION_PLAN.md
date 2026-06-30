# HaulBrokr database migration plan

Current workflow: keep using `pnpm --filter @workspace/db run push` with Drizzle Push for this production branch.

## Indexes added for current push workflow

- Jobs: request, customer, provider, status, payment status, scheduled date.
- Requests: customer, status, scheduled date, project.
- Bids: request, provider, status, request/status.
- Tickets and dispatch: job, driver, truck, status, workflow state.
- Realtime/audit feeds: job status update job/timestamp, activity profile/related/timestamp.
- Evidence and fleet: evidence job/uploader, truck owner/assigned driver/availability.

## Future versioned SQL rollout

1. Freeze Drizzle Push for production after the marketplace workflow stabilizes.
2. Generate a baseline SQL migration from the live schema and store it as migration `0000`.
3. Create forward-only migrations for enum additions, new columns, and indexes.
4. Add CI checks that run migrations against an empty database and a copy of production schema.
5. Require every schema PR to include migration SQL plus rollback notes.
6. Run migrations through staging with production-like data volume before release.
7. Keep Drizzle schema as the source of application types, but deploy via reviewed SQL migrations.
