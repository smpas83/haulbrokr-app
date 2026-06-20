# HaulBrokr Deployment Guide

> **Production path:** [DEPLOY-VERCEL-RENDER.md](./DEPLOY-VERCEL-RENDER.md) — Vercel (web) + Render (API) + Neon (database)

## Quick local start

```bash
chmod +x scripts/bootstrap.sh
docker compose up -d db
export DATABASE_URL=postgres://haulbrokr:haulbrokr@localhost:5432/haulbrokr?sslmode=disable
./scripts/bootstrap.sh
```

## Stack summary

| Layer | Provider |
|-------|----------|
| Web | Vercel (`haulbrokr.com`) |
| API | Render (`haulbrokr-api.onrender.com`, proxied at `/api`) |
| Database | Neon Postgres |
| Mobile | EAS → App Store / Play Store |

See [DEPLOY-VERCEL-RENDER.md](./DEPLOY-VERCEL-RENDER.md) for the full step-by-step checklist.

## Other docs

- [HAULBROKR_AUDIT.md](./HAULBROKR_AUDIT.md) — architecture audit
- [MIGRATION_TO_CURSOR.md](../MIGRATION_TO_CURSOR.md) — local dev details
