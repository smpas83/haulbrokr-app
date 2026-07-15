# Production Onboarding Certification

**Date:** 2026-07-15  
**PR #124:** Merged into `master` (`cc06a54`)  
**Follow-on:** Admin Onboarding Center (this branch / PR)

## Verdict

**PRODUCTION BLOCKED**

Deployment of PR #124 succeeded for web + API. Full live carrier upload → R2 → Neon → admin approve proof could not be completed inside Cursor because production Neon / R2 / staff credentials are not available to this agent.

## 1. PR #124 security / regression review

| Area | Finding | Risk |
|------|---------|------|
| `GET /storage/objects/*` staff ACL | Staff session + `compliance` permission can view objects that have a `driver_documents` row; owners still use Clerk profile ownership | Low — closes Unauthorized for staff; no open ACL |
| Content-Type finalize | Accepts `application/octet-stream` as compatible so R2 quirks do not delete valid uploads; still rejects true type mismatches (e.g. executable) | Low — intentional; covered by unit tests |
| Form/file sync | W-9/COI file upload sets matching form row to `pending` when present | Low |
| `GET /admin/onboarding-trace` | Gated by `requireStaffOrProfile` + `overview` permission | Low — staff-only |
| Unique `(profile_id, doc_type)` | Prevents duplicate doc rows | Low — applied via startup migration |

No secrets in PR. CI on merge: **success**. No high-severity regressions identified.

## 2. Production deployment

| Surface | Host | Commit | Status |
|---------|------|--------|--------|
| Web app | Vercel → `https://haulbrokr.com` | `cc06a54` | **success** (GitHub deployment) |
| API server | Render → `https://haulbrokr-api.onrender.com` | `cc06a54` | **success** (GitHub deployment) |
| Workers | None separate for this change | — | N/A |

Smoke (post-deploy):

- `GET /api/readyz` → `{"status":"ok"}` (direct + Vercel proxy)
- `GET /` → 200
- `GET /admin` → 200
- `GET /api/admin/onboarding-trace` (no cookie) → **401 Unauthorized**

## 3. Required production env names (values not revealed)

Declared for Render API (`render.yaml`) / `.env.example`:

- `DATABASE_URL` (Neon)
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
- `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`
- `STAFF_AUTH_SECRET`, `UPLOAD_TOKEN_SECRET`
- `ADMIN_USER_IDS`

Cursor agent environment presence (names only):

| Variable | In Cursor agent |
|----------|-----------------|
| `CLERK_SECRET_KEY` | SET |
| `CLERK_PUBLISHABLE_KEY` | SET |
| `DATABASE_URL` | UNSET |
| `R2_*` | UNSET |
| `STAFF_*` / staff password | UNSET |
| `VERCEL_TOKEN` | UNSET |

## 4. Live workflow status (A–J)

| Step | Status |
|------|--------|
| A–E Carrier signup / profile / truck / uploads | **Not run** — needs interactive Clerk + browser + R2 |
| F R2 + Neon + pending sync | **Not run** — no `DATABASE_URL` / R2 |
| G–J Admin dashboard approve + carrier sees approved | **Not run** — no staff session |
| `GET /admin/onboarding-trace` staff table | **Blocked** for data; endpoint **live** and staff-gated (401) |
| Carrier cannot open endpoint | **PASS** (401 without staff) |

## 5. Single manual action remaining

1. Export staff + Neon + R2 credentials in a secure operator shell (never into chat).
2. Complete browser steps A–J with a real test carrier.
3. Run:

```bash
chmod +x scripts/verify-live-carrier-onboarding.sh
./scripts/verify-live-carrier-onboarding.sh
```

4. Open `https://haulbrokr.com/admin` → **Onboarding** tab and confirm the new carrier timeline.

Only after a real document traverses **upload → R2 → Neon → admin View → approve** may this certification be upgraded to **PRODUCTION PASS**.

## Related docs

- `LIVE_CARRIER_ONBOARDING_REPORT.md`
- `ADMIN_ONBOARDING_CENTER.md`
- `FIXES_APPLIED.md` / `ONBOARDING_AUDIT.md` (from PR #124)
