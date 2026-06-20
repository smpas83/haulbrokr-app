# HaulBrokr

An "Uber for dump trucks" — a hauling marketplace connecting customers who need
material hauled with truck providers. This is a **pnpm monorepo** containing the
backend API, a web app, a mobile app (iOS + Android via Expo), a pitch deck, a promo,
and shared libraries.

## Quick start

```bash
# 1. Install pnpm (this repo requires pnpm — npm/yarn are blocked)
npm install -g pnpm

# 2. Install dependencies
pnpm install

# 3. Set environment variables (see the full list in MIGRATION_TO_CURSOR.md).
#    At minimum, the backend needs a Postgres connection string:
export DATABASE_URL=postgres://user:pass@localhost:5432/haulbrokr

# 4. Push the database schema (dev)
pnpm --filter @workspace/db run push

# 5. Run an app (each runs independently — set PORT to any free port)
PORT=5000 pnpm --filter @workspace/api-server run dev        # Backend API
PORT=5173 pnpm --filter @workspace/dumpbroker run dev        # Web app
PORT=8082 pnpm --filter @workspace/dumpbroker-mobile run dev # Mobile (Expo)
```

## Repo layout

```
artifacts/
  api-server/         Backend API (Express + Drizzle + Postgres)
  dumpbroker/         Web app (React + Vite + Tailwind)
  dumpbroker-mobile/  Mobile app (Expo → iOS + Android)
  dumpbroker-deck/    Pitch deck (slides)
  dumpbroker-promo/   Promo video
  mockup-sandbox/     Component preview (dev tooling)
lib/
  db/                 PostgreSQL schema + Drizzle client
  api-spec/           OpenAPI spec + Orval codegen
  api-zod/            Generated Zod schemas
  api-client-react/   Generated React Query hooks
```

## Common commands

```bash
pnpm run typecheck   # typecheck shared libs + all artifacts
pnpm run build       # typecheck + build all packages
```

## Documentation

- **[docs/DEPLOY-VERCEL-RENDER.md](./docs/DEPLOY-VERCEL-RENDER.md)** — **production deploy** (Vercel + Render + Neon)
- **[docs/HAULBROKR_AUDIT.md](./docs/HAULBROKR_AUDIT.md)** — architecture audit and launch checklist
- **[MIGRATION_TO_CURSOR.md](./MIGRATION_TO_CURSOR.md)** — local dev, environment variables
- **[DEVELOPER_HANDOFF.md](./DEVELOPER_HANDOFF.md)** — original developer handoff notes

## Notes

- **pnpm only.** A `preinstall` guard refuses npm/yarn.
- Internal package/folder names still use the original `dumpbroker` identifier; all
  user-facing branding is **HaulBrokr**. See `MIGRATION_TO_CURSOR.md` for why this is
  intentional.
- Never commit secrets or `.env` files — they are git-ignored.
