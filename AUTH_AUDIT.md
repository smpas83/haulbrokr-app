# AUTH_AUDIT.md

**Date:** 2026-07-15

## Auth stack

| Surface | Mechanism |
|---------|-----------|
| Web app | Clerk `@clerk/react` — session cookies to same-origin `/api` |
| Mobile | Clerk `@clerk/expo` — `Authorization: Bearer <JWT>` |
| API | `@clerk/express` `clerkMiddleware` + `getAuth(req).userId` |
| Staff admin | Password login → HMAC cookie `haulbrokr_staff` (`STAFF_AUTH_SECRET`) |
| Upload tokens | HMAC `UPLOAD_TOKEN_SECRET` (uploadToken / storageToken) |

## Middleware map

| Middleware | File | Behavior |
|------------|------|----------|
| `requireAuth` | `middlewares/requireAuth.ts:7` | 401 `{ error: "Unauthorized" }` if no Clerk userId |
| `requireProfile` | `requireAuth.ts:18` | 401 if no Clerk; 404 if no profile |
| `attachClerkProfileIfPresent` | `requireAuth.ts:36` | Soft attach |
| `attachStaffSession` | `middlewares/staffAuth.ts` | Soft attach staff cookie |
| `requireStaffOrProfile` | `staffAuth.ts` | Staff **or** profile |
| `requireProfileOrStaffCompliance` | `staffAuth.ts` (**new**) | Profile **or** staff+compliance |
| `requirePermission` | `requireAdmin.ts` | 403 if missing permission |

## Root cause: Admin document viewer Unauthorized

**Exact path:**

1. Admin logs in via `/admin/login` → `haulbrokr_staff` cookie  
2. Dashboard lists docs via `/admin/documents` (uses `requireStaffOrProfile`) → OK  
3. “View” opened `/api/storage/objects/...` which used **`requireProfile` only**  
4. No Clerk session → **`requireAuth.ts` line 22** → `401 Unauthorized`

**Fix:** `GET /storage/objects/*` now runs `attachStaffSession` + `attachClerkProfileIfPresent` + `requireProfileOrStaffCompliance`. Frontend opens docs via credentialed `fetch` + blob URL (cookies included).

## Clerk token passing checklist

| Client | Tokens passed? | Evidence |
|--------|----------------|----------|
| Web API calls | Yes (cookies, `credentials: "include"`) | `apiFetch.ts` / `custom-fetch.ts` |
| Web R2 PUT | N/A (presigned URL) | `storageUpload.ts` |
| Mobile API | Yes (Bearer) | `useLiveApi.ts` |
| Staff admin API | Staff cookie | `staff-auth.ts` |
| Staff document View (before) | **No effective auth on storage route** | Fixed |

## Staff role resolution

Order in `getStaffRole` (`requireAdmin.ts`):

1. `req.staffUser.staffRole` (password session)  
2. `ADMIN_USER_IDS` allowlist → bootstrap `cto`  
3. `profiles.staff_role` column  

Production without `ADMIN_USER_IDS` does **not** auto-grant (safe).

## Secrets in this environment

| Secret | Status |
|--------|--------|
| `CLERK_SECRET_KEY` | SET |
| `CLERK_PUBLISHABLE_KEY` | SET |
| `VITE_CLERK_PUBLISHABLE_KEY` | SET |
| `DATABASE_URL` | UNSET |
| `R2_*` | UNSET |
| `STAFF_AUTH_SECRET` / `UPLOAD_TOKEN_SECRET` | UNSET here (required on Render) |

## RLS

No Postgres RLS policies are used. Authorization is entirely application middleware.
