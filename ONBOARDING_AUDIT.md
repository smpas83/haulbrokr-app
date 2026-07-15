# ONBOARDING_AUDIT.md

**Date:** 2026-07-15  
**Scope:** Landing → Signup → Verification → Login → Company → Driver → Equipment → Documents → Storage → DB → Admin → Approval  
**Stack (live):** Clerk + Neon Postgres + Cloudflare R2 — **not Supabase**

---

## Executive verdict

Carriers can create accounts and profiles, but several bugs caused uploaded documents to disappear from admin view, Pending to stay at 0, and the admin document viewer to return **Unauthorized**. Those bugs are fixed in this branch.

---

## Step-by-step forensic results

| Step | FE→API? | API OK? | Storage? | DB record? | Admin sees? | Notes |
|------|---------|---------|----------|------------|-------------|-------|
| Landing page | N/A | N/A | N/A | N/A | N/A | Static marketing |
| Sign up (Clerk) | Yes | Clerk | N/A | No profile yet | No | Email verification via Clerk |
| Email verification | Clerk | Clerk | N/A | N/A | N/A | Blocks until verified |
| Login | Yes | Clerk cookies / Bearer | N/A | N/A | N/A | Web: cookies; Mobile: JWT |
| Company / profile creation | `POST /profiles` | Yes | N/A | `profiles` | Yes | Onboarding page — no docs step |
| Driver creation | Invite code join | Yes | N/A | `profiles` role=driver | Yes | Separate from carrier docs |
| Equipment / truck | `POST /trucks` | Yes | N/A | `trucks` | Yes | After profile |
| Document upload | Yes | **Was fragile** | R2 | `driver_documents` | **Was broken for staff View** | See DOCUMENT_UPLOAD_TRACE |
| Form W-9 / Insurance | Yes | Yes | N/A | `w9_submissions` / `insurance_submissions` | Compliance tab | Parallel system to file uploads |
| Admin dashboard stats | Yes | Yes | N/A | Counts | **Pending undercounted** | Fixed: includes uploaded files |
| Admin document viewer | Yes | **401 for staff login** | R2 | Exists | **Unauthorized** | Fixed: staff session ACL |
| Approval workflow | PATCH admin compliance | Yes | N/A | status→verified | Yes | Syncs forms on W-9/COI approve |

---

## Answers to the 12 investigation questions

1. **Is the frontend actually calling the API?** Yes — `uploadFileToStorage` → `PUT /driver-docs/:docType`; forms hit `/account/w9` and `/account/insurance`.
2. **Is the API succeeding?** Upload finalize could fail with 422 on content-type mismatch and delete the R2 object (silent from user POV if toast dismissed). Fixed.
3. **Is Supabase receiving the data?** N/A — stack uses Neon + R2, not Supabase.
4. **Is Storage receiving uploaded files?** Yes (Cloudflare R2) when finalize succeeds.
5. **Is the database record being created?** Yes in `driver_documents` when finalize + PUT succeed.
6. **Is the admin dashboard reading the correct tables?** Mostly — profile detail reads `driver_documents`; Compliance tab merges forms + uploads; Overview `pendingCompliance` previously **ignored file uploads**.
7. **Is anything filtered incorrectly?** Compliance tab only shows `role=provider` and `ADMIN_UPLOAD_DOC_TYPES`; drops empty bundles.
8. **Are RLS policies blocking data?** No Postgres RLS in this app — API middleware is the ACL.
9. **Are Clerk auth tokens being passed?** Web: session cookies; Mobile: Bearer JWT. Staff password login uses separate cookie (`haulbrokr_staff`).
10. **Are uploads silently failing?** Finalize content-type mismatch deleted objects; orphan cleaner can delete unfinalized objects after 30m.
11. **Are errors swallowed?** Upload UI shows toasts; admin review notification/email failures are swallowed (by design).
12. **Path where user thinks upload saved but nothing saved?** Yes — finalize 422 after successful R2 PUT deleted the object and never wrote `driver_documents` → Documents (0).

---

## Root causes of reported symptoms

| Symptom | Exact cause |
|---------|-------------|
| Documents (0) | Upload never finalized (MIME mismatch) **or** carrier only filled forms (not file uploads) — profile detail only lists `driver_documents` |
| Pending Documents = 0 | Overview `pendingCompliance` counted only form `pending` rows, not `driver_documents.status='uploaded'` |
| Verified shows few records | Only rows with `status='verified'` — most never completed upload or never approved |
| Admin viewer Unauthorized | `GET /storage/objects/*` used `requireProfile` (Clerk only). Staff password session → **401** at `requireAuth.ts:22` |
| New carriers missing docs | Same as Documents (0) + dual compliance systems |

---

## Onboarding progress (save & resume)

- Uploads and forms are persisted independently; leaving mid-flow does **not** wipe prior work.
- New: `GET /account/onboarding-progress` and `GET /admin/onboarding-trace` report exact step status per carrier.
- Account Documents progress bar now counts `uploaded` as partial progress.

---

## Production live-user traces

**Blocker:** This cloud environment only has Clerk keys injected — **no `DATABASE_URL` / R2 credentials**. Live per-carrier traces require:

```bash
DATABASE_URL='postgresql://…neon…' pnpm --filter @workspace/api-server exec tsx scripts/e2e-onboarding-trace.ts
# or call GET /admin/onboarding-trace as staff after deploy
```

Local E2E against Postgres: **PASS** (see FIXES_APPLIED.md).

---

## Certification

| Area | Status |
|------|--------|
| Code-path fixes | **PASS** |
| Unit tests (360) | **PASS** |
| Local DB E2E onboarding | **PASS** |
| Live production E2E with real Clerk signup + R2 | **FAIL / BLOCKED** — secrets not in this environment |
| Live per-user forensic dump | **FAIL / BLOCKED** — no Neon URL here |
