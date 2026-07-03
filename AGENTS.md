# AGENTS.md

## Cursor Cloud specific instructions

HaulBrokr is a pnpm monorepo ("Uber for dump trucks"). Standard commands live in
`README.md` and `MIGRATION_TO_CURSOR.md`; this section only captures the
non-obvious cloud setup/run caveats.

### Services & how to run them (dev)
- **PostgreSQL** is required for the API. It is installed in the VM (apt `postgresql-16`),
  not via the update script. Start it each session if not already running:
  `sudo pg_ctlcluster 16 main start`. The dev role/db are `haulbrokr`/`haulbrokr`
  (superuser), reachable at `postgres://haulbrokr:haulbrokr@127.0.0.1:5432/haulbrokr?sslmode=disable`.
- **`.env`** (repo root, git-ignored) holds dev secrets and is read by the API and by
  schema pushes. If missing, recreate it with: `DATABASE_URL` (above),
  `PAYMENTS_MOCK_MODE=true`, 32+ char `UPLOAD_TOKEN_SECRET` / `TICKET_QR_SECRET` /
  `STAFF_AUTH_SECRET`, `BASE_PATH=/`, and **syntactically valid** Clerk keys
  (`CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k`,
  any `sk_test_...` secret). The backend's Clerk SDK rejects malformed keys (e.g.
  `pk_test_placeholder`) and returns 500 on every `/api` route, so use a parseable dummy.
- Most commands need the env exported: `set -a && . ./.env && set +a` before running.
- **API server**: `PORT=8080 pnpm --filter @workspace/api-server run dev` — note `dev`
  does a full esbuild build then `node dist/index.mjs` with **no watch**, so re-run it
  after backend changes (it does not hot-reload).
- **Web app**: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/haulbrokr run dev`
  (Vite). It proxies `/api` → `127.0.0.1:8080`. Vite loads `.env` from the app dir, so
  export `VITE_CLERK_PUBLISHABLE_KEY`/`BASE_PATH` (or run with env exported from root).
- **Schema** is applied with Drizzle push (no SQL migration files, no RLS):
  `pnpm --filter @workspace/db run push` (use `push-force` for non-interactive
  drop/recreate). Re-run after editing `lib/db/src/schema/`.
- **Demo data**: `pnpm --filter @workspace/api-server run seed-demo` seeds nationwide
  loads, trucks, live GPS, routes, and active jobs (idempotent; demo rows namespaced
  `demo_*` / invite codes `DEMO*`). Run it against any `DATABASE_URL` (local or Neon) to
  populate an empty DB — a fresh DB legitimately shows empty load boards/maps otherwise.
- **Maps require `GOOGLE_MAPS_SERVER_API_KEY`** (or `GOOGLE_MAPS_API_KEY`) — all
  `/api/maps/*` and `/api/tracking/*` routes return 503 without it, and in production the
  API refuses to boot without it (`validateProductionEnv`). Mobile native maps also need a
  Google key (`app.config.js` wires Android from `GOOGLE_MAPS_API_KEY`; iOS has none).

### Testing / verifying
- Lint: there is **no `lint` script** in any package; `pnpm -r --if-present run lint`
  is a no-op (don't treat the empty run as a failure).
- Tests: `pnpm -r --if-present run test` (Vitest). Route/unit tests **mock
  `@workspace/db`** with a hand-rolled proxy and build their own minimal Express app —
  they do not import `artifacts/api-server/src/app.ts` and do not need a live DB. When a
  route gains a new `@workspace/db` table dependency, add that table token to the
  relevant test's mock or it will throw (the mock returns `[]` only for tokens it
  exports).
- Integration tests against a real DB: `RUN_DB_TESTS=true pnpm --filter
  @workspace/api-server run test:integration`.

### Auth caveats (important for manual/UI testing)
- The **web UI is gated behind Clerk** (`ClerkProvider` in `src/AuthShell.tsx` wraps all
  routes); if Clerk JS fails to initialize, every page (incl. the marketing landing)
  renders a blank screen. To render the web UI on **localhost you need Clerk
  _development_ instance keys** (`pk_test_`/`sk_test_`): a syntactically-valid dummy key
  fails because Clerk JS can't load its host, and **production keys (`pk_live_`/`sk_live_`)
  are domain-locked** (Clerk rejects the `localhost` origin with a 429 / "Production keys
  are only allowed for domain …"). Either use dev-instance keys or add `localhost` to the
  instance's allowed origins.
- **Staff/admin auth is independent of Clerk** (cookie session via `STAFF_AUTH_SECRET`).
  Seed staff logins with `STAFF_DEFAULT_PASSWORD='...' pnpm --filter
  @workspace/api-server run seed-staff` (creates ceo/cfo/cto/etc.), then
  `POST /api/admin/login {username,password}`. Use the returned cookie to exercise
  admin/compliance APIs end-to-end without Clerk.
