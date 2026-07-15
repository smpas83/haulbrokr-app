# FIXES_APPLIED.md

**Date:** 2026-07-15  
**Branch:** `cursor/onboarding-forensic-fix-06f2`

## Bugs fixed

### 1. Admin document viewer → Unauthorized (CRITICAL)

- **Cause:** `GET /storage/objects/*` required Clerk profile; staff password sessions got 401  
- **Files:**  
  - `artifacts/api-server/src/middlewares/staffAuth.ts` — `requireProfileOrStaffCompliance`  
  - `artifacts/api-server/src/routes/storage.ts` — attach staff + new ACL  
  - `artifacts/haulbrokr/src/components/admin-insights.tsx` — credentialed blob View  
  - `artifacts/haulbrokr/src/pages/admin.tsx` — same for Compliance tab

### 2. Uploads deleted on content-type mismatch (CRITICAL)

- **Cause:** R2 PutObject unsigned ContentType; finalize rejected `application/octet-stream` and deleted object  
- **Files:**  
  - `artifacts/api-server/src/lib/objectStorage.ts` — sign with ContentType  
  - `artifacts/api-server/src/routes/storage.ts` — `contentTypesCompatible()`

### 3. Pending compliance ignored file uploads (HIGH)

- **Cause:** Overview counted only form `pending` rows  
- **Files:**  
  - `artifacts/api-server/src/lib/onboardingTrace.ts` — `countPendingComplianceWork`  
  - `artifacts/api-server/src/routes/admin.ts` — overview uses totalPending + documentsVerified  
  - `artifacts/haulbrokr/src/components/admin-insights.tsx` — Verified shows count

### 4. File upload ↔ form queue desync (HIGH)

- **Cause:** Uploading W-9/COI files did not move forms out of `not_submitted`/`rejected`  
- **Files:**  
  - `artifacts/api-server/src/routes/driver-docs.ts` — calls `syncFormPendingFromFileUpload`  
  - `artifacts/api-server/src/lib/onboardingTrace.ts`

### 5. No uniqueness on document type per profile (MEDIUM)

- **File:** `lib/db/src/schema/driver-docs.ts` — unique index `(profile_id, doc_type)`  
- Apply in prod: `CREATE UNIQUE INDEX IF NOT EXISTS driver_documents_profile_doc_type_uidx ON driver_documents (profile_id, doc_type);` (dedupe first if needed)

### 6. Onboarding progress visibility (PRODUCT)

- **New APIs:**  
  - `GET /admin/onboarding-trace`  
  - `GET /admin/onboarding-trace/:profileId`  
  - `GET /account/onboarding-progress`  
- Profile detail returns `onboarding` object  
- Documents UI counts `uploaded` as partial progress

### 7. Document status for providers (MEDIUM)

- `documentStatus.ts` merges form + file status so uploaded files show as in-progress

## Verification

| Check | Result |
|-------|--------|
| `pnpm --filter @workspace/api-server test` | **360/360 PASS** |
| `tsx scripts/e2e-onboarding-trace.ts` (local Postgres) | **PASS** |
| Live Clerk signup → R2 → prod Neon | **BLOCKED** (no DATABASE_URL / R2 in agent env) |

## Deploy checklist

1. Merge & deploy API (Render) + web (Vercel)  
2. Run unique index SQL on Neon (if `drizzle-kit push` not used)  
3. Confirm Render has `R2_*`, `PRIVATE_OBJECT_DIR`, `UPLOAD_TOKEN_SECRET`, `STAFF_AUTH_SECRET`  
4. As staff: open a pending document View — must stream file, not JSON Unauthorized  
5. Call `GET /api/admin/onboarding-trace` and review stuck carriers  
6. Spot-check a new carrier: upload W-9 → Pending review increments → Approve → Verified increments  

## Remaining production blockers

1. **Live production E2E** with real Clerk user + R2 must be run after deploy (secrets not available to this agent).  
2. **Per-user forensic dump of current live signups** requires Neon `DATABASE_URL` — run `/admin/onboarding-trace` post-deploy.  
3. Horizontal scaling: upload token replay Set is still in-memory (known prior issue).
