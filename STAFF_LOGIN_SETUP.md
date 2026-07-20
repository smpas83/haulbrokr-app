# Staff Login Setup

How HaulBrokr staff (admin command center) accounts are stored, created, and authenticated.

## Quick answers

| Question | Answer |
|----------|--------|
| Where are usernames stored? | Postgres table `staff_users`, column `username` |
| Where are passwords stored? | Same table, column `password_hash` (scrypt `salt:hex`, never plaintext) |
| Seed script? | Yes — `pnpm --filter @workspace/api-server run seed-staff` |
| Default admin account? | Seed creates `ceo`, `president`, `cto`, `cfo`, `accounting`, `it`, `programmer` |
| Create a new staff account? | `pnpm create:staff -- --username … --password …` |
| Reset a staff password? | Re-run `pnpm create:staff` with the same `--username` and a new `--password` |
| Credentials table? | `staff_users` |
| Is Clerk the staff IdP? | **No.** Clerk is the primary IdP for customers/carriers. Staff password login is independent. Clerk can *also* unlock admin if `ADMIN_USER_IDS` or `profiles.staff_role` is set. |

## Architecture (two paths)

### 1. Password staff (primary for `/admin/login`)

1. Operator opens `https://haulbrokr.com/admin/login`
2. Browser `POST /api/admin/login` with `{ username, password }` (`credentials: "include"`)
3. API looks up `staff_users` by lowercase username, verifies scrypt hash
4. API sets httpOnly cookie `haulbrokr_staff` (HMAC-SHA256 session, 12h)
5. Admin API routes accept that cookie via `attachStaffSession`

**Clerk is not involved** in this path.

### 2. Clerk-linked staff (optional)

Marketplace users authenticate with Clerk. A Clerk user becomes staff when:

- Their Clerk user id is listed in `ADMIN_USER_IDS` (bootstraps as `cto`), or
- `profiles.staff_role` is set (Team tab / `PATCH /api/admin/staff/:profileId`)

Admin middleware (`requireStaffOrProfile`) accepts **either** the staff cookie **or** a Clerk profile with a staff role.

## Schema

Table: `staff_users` (Drizzle: `lib/db/src/schema/staff-users.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `username` | text unique | Stored lowercase at login/create time |
| `password_hash` | text | `saltHex:derivedKeyHex` from Node `crypto.scrypt` |
| `staff_role` | enum | `ceo`, `president`, `cto`, `cfo`, `accounting`, `it`, `programmer` (+ legacy `ap`/`ar`) |
| `display_name` | text | Shown in admin UI |
| `active` | boolean | Inactive users cannot log in |
| `created_at` / `updated_at` | timestamptz | |

Password hashing lives in `artifacts/api-server/src/lib/staffPassword.ts` — always use `hashStaffPassword()` / `verifyStaffPassword()`; do not invent a parallel format.

## Create or reset a staff account (recommended)

Requires `DATABASE_URL` pointing at the target Neon database (repo-root `.env` or shell export).

```bash
# Create
pnpm create:staff -- --username admin --password "StrongPassword"

# Reset password (same username upserts and rotates the hash)
pnpm create:staff -- --username admin --password "NewStrongPassword"

# Explicit role / display name
pnpm create:staff -- \
  --username accounting \
  --password "StrongPassword" \
  --role accounting \
  --display-name "Accounting"
```

Notes:

- pnpm needs the `--` separator so flags are passed to the script.
- Passwords are hashed with production scrypt before insert/update; plaintext is never written to the DB or printed.
- Default `--role` is `cto` (full admin permissions).
- Minimum password length: 8 characters.

Script: `scripts/create-staff-user.ts`  
Package script: root `pnpm create:staff` (also `pnpm --filter @workspace/scripts run create-staff`).

## Seed all default role accounts

Creates/updates the seven role usernames with a shared password:

```bash
STAFF_DEFAULT_PASSWORD='YourSecureProductionPassword' \
  pnpm --filter @workspace/api-server run seed-staff
```

- Non-production fallback password if unset: `HaulBrokr-Staff-2026!`
- Production **requires** `STAFF_DEFAULT_PASSWORD`
- Re-running seed **resets passwords** for all seeded usernames to that value

Prefer `pnpm create:staff` when you only need one account or a unique password.

## Login checklist

1. Ensure the row exists and `active = true` in `staff_users`
2. Ensure API has `STAFF_AUTH_SECRET` (≥32 chars) in production (signs the session cookie)
3. Open `/admin/login`, sign in with username + password
4. Confirm `/api/admin/access` returns `authMethod: "staff"`

## Live verification script

`scripts/verify-live-carrier-onboarding.sh` uses the **password staff** flow (not Clerk):

```bash
export STAFF_USERNAME=admin
export STAFF_PASSWORD='…'   # never commit or paste into chat
./scripts/verify-live-carrier-onboarding.sh
```

It `POST`s `/api/admin/login`, stores the `haulbrokr_staff` cookie, then calls staff-protected admin APIs.

## Env vars

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres (create/seed scripts + API) |
| `STAFF_AUTH_SECRET` | HMAC secret for `haulbrokr_staff` cookie |
| `STAFF_DEFAULT_PASSWORD` | Password used only by `seed-staff` |
| `ADMIN_USER_IDS` | Optional comma-separated Clerk IDs that bootstrap as `cto` |
| `STAFF_USERNAME` / `STAFF_PASSWORD` | Operator env for live verify script only |

## Related files

| File | Role |
|------|------|
| `lib/db/src/schema/staff-users.ts` | Schema |
| `artifacts/api-server/src/lib/staffPassword.ts` | Hash / verify |
| `artifacts/api-server/src/lib/staffSession.ts` | Cookie sign / verify |
| `artifacts/api-server/src/routes/staff-auth.ts` | `POST /api/admin/login` |
| `artifacts/api-server/src/middlewares/staffAuth.ts` | Attach staff session |
| `artifacts/api-server/src/middlewares/requireAdmin.ts` | Roles & permissions |
| `artifacts/api-server/scripts/seed-staff-users.ts` | Bulk seed |
| `scripts/create-staff-user.ts` | Create/reset one account |
| `AUTH_AUDIT.md` | Broader auth stack map |
