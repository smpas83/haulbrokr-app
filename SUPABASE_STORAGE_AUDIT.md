# SUPABASE_STORAGE_AUDIT.md

**Date:** 2026-07-15

## Finding

**HaulBrokr does not use Supabase Storage (or Supabase Auth / Database).**

Production object storage is **Cloudflare R2** (S3-compatible) via `@aws-sdk/client-s3`.

Database is **Neon Postgres** accessed with Drizzle + `node-postgres` (`DATABASE_URL`).

Any reference to “Supabase” in ops conversation is a misnomer for this codebase.

---

## Actual storage architecture

| Item | Value |
|------|--------|
| Provider | Cloudflare R2 |
| Client | `artifacts/api-server/src/lib/objectStorage.ts` |
| Env | `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` |
| Private prefix | `PRIVATE_OBJECT_DIR` (prod: `/haulbrokr/private`) |
| Public prefix | `PUBLIC_OBJECT_SEARCH_PATHS` (prod: `/haulbrokr/public`) |
| Object path in DB | `/objects/uploads/<uuid>` |
| Serve private | `GET /api/storage/objects/*` |
| Serve public | `GET /api/storage/public-objects/*` |

## Permissions model (not RLS)

- No bucket RLS policies (R2 has no Postgres-style RLS).
- App ACL:
  - Upload/finalize: Clerk `requireProfile`
  - Download private: owner profile **or** staff with `compliance` permission (staff cookie supported after fix)
  - Orphan objects without `driver_documents` row → 403 even for staff

## Issues found & fixed

1. PutObject signed **without** `ContentType` → metadata drift → finalize rejects  
2. Finalize treated `application/octet-stream` as hard failure  
3. Staff could not download via admin View (auth middleware, not storage ACL)

## Dead code

- `upload_sessions` table + cleanup scheduler: **not used** by live upload path (HMAC tokens only)
- Comments still mentioning GCS in places — historical

## This environment

R2 credentials: **not injected** — cannot list production bucket contents from this agent.
