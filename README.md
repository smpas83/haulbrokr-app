# Kash Intelligence Platform

This repository now contains the Kash Intelligence Platform foundation alongside
the existing HaulBrokr production artifacts. Kash AI OS is the interface; KIP is
the reusable multi-business platform for agents, memory, workflows, analytics,
voice, integrations, and governance.

## KIP foundation

```bash
pnpm lint
pnpm typecheck
pnpm --filter @kip/dashboard dev
pnpm --filter @kip/admin dev
pnpm --filter @kip/voice-app dev
pnpm --filter @kip/api dev
```

KIP workspaces:

- HaulBrokr
- MerchNow
- Golden West Food Group
- Stratus Group
- Personal

See [docs/KIP_ARCHITECTURE.md](./docs/KIP_ARCHITECTURE.md) for the KIP architecture, package graph, memory model, agents, integrations, and remaining production work.

## HaulBrokr

An "Uber for dump trucks" - a hauling marketplace connecting customers who need
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
PORT=5173 pnpm --filter @workspace/haulbrokr run dev        # Web app
PORT=8082 pnpm --filter @workspace/haulbrokr-mobile run dev # Mobile (Expo)
```

## Repo layout

```
artifacts/
  api-server/         Backend API (Express + Drizzle + Postgres)
  haulbrokr/         Web app (React + Vite + Tailwind)
  haulbrokr-mobile/  Mobile app (Expo → iOS + Android)
  haulbrokr-deck/    Pitch deck (slides)
  haulbrokr-promo/   Promo video
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
- Package and folder names use the `haulbrokr` identifier; user-facing branding is **HaulBrokr**.
- Never commit secrets or `.env` files — they are git-ignored.
