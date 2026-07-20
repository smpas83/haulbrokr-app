# STAFF_AUTH_AUDIT.md

**Date:** 2026-07-15  
**Scope:** HaulBrokr staff (admin command center) authentication  
**Production probe:** `https://haulbrokr.com`

---

## Executive summary

Staff admin auth is a **username + password** system stored in Postgres table `staff_users`. Login is `POST /api/admin/login`, which sets an HMAC-signed cookie `haulbrokr_staff`. **Clerk is not used for staff password login.** Clerk is only an alternate path for admin API access (Clerk profile with `profiles.staff_role`, or `ADMIN_USER_IDS` allowlist).

**Production currently has valid staff user rows** for the seven seeded usernames (`ceo`, `president`, `cto`, `cfo`, `accounting`, `it`, `programmer`). The documented default password `HaulBrokr-Staff-2026!` does **not** work against production, so either a custom `STAFF_DEFAULT_PASSWORD` was used at seed time or passwords were rotated afterward.

---

## 1. Implementation of `POST /api/admin/login`

| Item | Location |
|------|----------|
| Route | `artifacts/api-server/src/routes/staff-auth.ts` → `router.post("/admin/login", …)` |
| Mount | `artifacts/api-server/src/routes/index.ts` → `router.use(staffAuthRouter)` under `/api` |
| Frontend | `artifacts/haulbrokr/src/pages/admin-login.tsx` → `fetch("/api/admin/login", { credentials: "include" })` |

### Flow

1. Validate body: `{ username, password }` (zod).
2. Normalize username to lowercase.
3. Rate-limit: 5 failed attempts per `ip:username` within 15 minutes → `429`.
4. Load row from `staff_users` by username.
5. Reject if missing or `active = false` (same error as bad password).
6. Verify password with `verifyStaffPassword` (scrypt).
7. Sign session via `signStaffSession(user.id, staffRole)`.
8. Set httpOnly cookie `haulbrokr_staff` (secure in production, SameSite=lax, 12h TTL).
9. Return `{ ok, displayName, staffRole, permissions }`.

Logout: `POST /api/admin/logout` clears the cookie.

---

## 2. Where staff users are stored

**Primary store:** PostgreSQL table `staff_users` (Drizzle model `staffUsersTable`).

| File | Purpose |
|------|---------|
| `lib/db/src/schema/staff-users.ts` | Table definition |
| `lib/db/drizzle/meta/0000_snapshot.json` | Schema snapshot (`public.staff_users`) |

**Secondary / alternate staff path (Clerk users, not password accounts):**

| Store | Column | Role |
|-------|--------|------|
| `profiles` | `staff_role` | Clerk-signed-in users granted admin permissions via Team tab / API |
| Env `ADMIN_USER_IDS` | Clerk user IDs | Bootstrap superadmin (`cto` permissions) without a `staff_role` |

Password-login staff live **only** in `staff_users`. They do not need a Clerk account or a `profiles` row.

---

## 3. Table / schema that stores usernames

```sql
-- public.staff_users (from Drizzle schema)
id              serial PRIMARY KEY
username        text NOT NULL UNIQUE   -- stored lowercase at login/seed
password_hash   text NOT NULL
staff_role      staff_role NOT NULL     -- enum
display_name    text NOT NULL
active          boolean NOT NULL DEFAULT true
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

Username uniqueness: constraint `staff_users_username_unique`.

Assignable roles: `ceo`, `president`, `cto`, `cfo`, `accounting`, `it`, `programmer`  
(Legacy enum values `ap` / `ar` still accepted for back-compat.)

---

## 4. How passwords are hashed

| Item | Detail |
|------|--------|
| Module | `artifacts/api-server/src/lib/staffPassword.ts` |
| Algorithm | Node.js `crypto.scrypt` |
| Format | `{saltHex}:{derivedKeyHex}` |
| Salt | 16 random bytes → hex |
| Key length | 64 bytes |
| Verify | Re-derive + `timingSafeEqual` |

**Not** bcrypt/argon2. Session tokens use a separate HMAC-SHA256 secret (`STAFF_AUTH_SECRET`), not the password hash.

---

## 5. Seed scripts that create default staff accounts

| Script | Command | What it creates |
|--------|---------|-----------------|
| `artifacts/api-server/scripts/seed-staff-users.ts` | `pnpm --filter @workspace/api-server run seed-staff` | Upserts 7 users (see below) with one shared password |
| `scripts/setup-neon.sh` | interactive Neon setup | Runs schema push + `seed-staff` |
| `artifacts/api-server/scripts/e2e-onboarding-trace.ts` | e2e only | May insert `e2eadmin` if table empty |

### Seeded usernames (canonical set)

| Username | Display name | Role |
|----------|--------------|------|
| `ceo` | CEO | `ceo` |
| `president` | President | `president` |
| `cto` | CTO | `cto` |
| `cfo` | CFO | `cfo` |
| `accounting` | Accounting | `accounting` |
| `it` | IT | `it` |
| `programmer` | Programmer | `programmer` |

Password source: `STAFF_DEFAULT_PASSWORD`, or local fallback `HaulBrokr-Staff-2026!` (production seed **requires** `STAFF_DEFAULT_PASSWORD`).

---

## 6. Migrations that insert staff users

**None.**

- Schema is applied with `drizzle-kit push` (`pnpm --filter @workspace/db run push`).
- Journal entry `0000_dazzling_drax` is a schema snapshot only — **no SQL data migration inserts into `staff_users`**.
- Staff rows are created only by seed / create-staff scripts (or manual SQL).

---

## 7. Environment variables used by admin authentication

| Variable | Required for | Purpose |
|----------|--------------|---------|
| `DATABASE_URL` | Login + seeds | Postgres (Neon) containing `staff_users` |
| `STAFF_AUTH_SECRET` | Session cookies (prod) | HMAC secret for `haulbrokr_staff` (≥32 chars). Falls back to `TICKET_QR_SECRET` |
| `TICKET_QR_SECRET` | Fallback | May substitute for `STAFF_AUTH_SECRET` |
| `STAFF_DEFAULT_PASSWORD` | Seeding only | Shared password written by `seed-staff` (not read at login time) |
| `ADMIN_USER_IDS` | Optional Clerk bootstrap | Comma-separated Clerk IDs → auto `cto` on admin routes |
| `NODE_ENV` | Cookie flags / prod checks | `secure` cookies; blocks default seed password in production |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | Clerk path only | Not required for staff password login itself |

Render (`render.yaml`) auto-generates `STAFF_AUTH_SECRET`, `TICKET_QR_SECRET`, `UPLOAD_TOKEN_SECRET`.

---

## 8. Is Clerk involved after login, or only on authenticated routes?

**Staff password login path: Clerk is not involved.**

1. `/admin/login` → password check → `haulbrokr_staff` cookie.
2. Admin API routes run `attachStaffSession` then `attachClerkProfileIfPresent`.
3. Permission resolution (`getStaffRole`) prefers `req.staffUser` (cookie) first.
4. `/admin/access` reports `authMethod: "staff"` when the cookie session is present.

**Clerk is a parallel auth path**, not a post-login step for password staff:

| Path | How admin access is granted |
|------|-----------------------------|
| Staff password | `staff_users` + cookie — no Clerk session needed |
| Clerk + `profiles.staff_role` | Signed-in Clerk user with role assigned in Team tab |
| Clerk + `ADMIN_USER_IDS` | Allowlisted Clerk ID bootstraps as `cto` |

The web shell wraps routes in `ClerkProvider`, and `/admin` / `/admin/login` are **not** gated behind Clerk sign-in. Global `clerkMiddleware` runs on the API for marketplace users; staff cookie auth works independently.

---

## Existing staff usernames

### Canonical (code / seed)

`ceo`, `president`, `cto`, `cfo`, `accounting`, `it`, `programmer`

### Production (live probe, 2026-07-15)

Without `DATABASE_URL` access, presence was inferred via login latency (scrypt runs only when a matching active row exists):

| Username | Inference |
|----------|-----------|
| `ceo`, `president`, `cto`, `cfo`, `accounting`, `it`, `programmer` | **Present** (~400–500ms failed-login latency; `ceo` also hit rate-limit 429 after retries) |
| `admin` | **Absent** (~190ms, same as nonexistent usernames) |

Default seed password `HaulBrokr-Staff-2026!` → `401` for `ceo` (not the production password).

To list exactly from the DB:

```sql
SELECT id, username, staff_role, display_name, active, created_at
FROM staff_users
ORDER BY id;
```

---

## How to reset a password

### Option A — create/update CLI (recommended)

```bash
export DATABASE_URL='postgresql://...neon.../haulbrokr?sslmode=require'
pnpm create:staff --username ceo --password 'NewSecurePassword!' --role ceo
```

Uses production scrypt hashing; upserts by username; reactivates the account.

### Option B — re-run full seed (resets all seven to one password)

```bash
export DATABASE_URL='postgresql://...'
STAFF_DEFAULT_PASSWORD='NewSecurePassword!' \
  pnpm --filter @workspace/api-server run seed-staff
```

### Option C — SQL + hash helper

Generate a hash in Node with `hashStaffPassword`, then:

```sql
UPDATE staff_users
SET password_hash = '<salt:hex>', active = true, updated_at = now()
WHERE username = 'ceo';
```

There is no in-app “forgot password” UI for staff.

---

## How to create a new staff user

```bash
export DATABASE_URL='postgresql://...neon.../haulbrokr?sslmode=require'
pnpm create:staff --username admin --password 'YourSecurePassword!' --role cto --display-name 'Ops Admin'
```

| Flag | Default | Notes |
|------|---------|-------|
| `--username` / `-u` | required | Stored lowercase |
| `--password` / `-p` | required | Min 8 chars; hashed with scrypt |
| `--role` / `-r` | `cto` | One of assignable roles |
| `--display-name` / `-n` | username | Shown in admin UI |

Equivalent package script: `pnpm --filter @workspace/api-server run create-staff -- …`

**Clerk Team-tab staff** (marketplace Clerk users with admin UI access) are separate: assign `profiles.staff_role` via `PATCH /api/admin/staff/:profileId` (`manage_staff` permission). Those accounts do not appear in `staff_users` and cannot use `/admin/login` password form.

---

## Whether production currently has any valid staff users

**Yes — password-auth staff rows exist in production** for the seven seeded usernames (timing evidence above).  

**Caveats:**

1. This agent environment has **no `DATABASE_URL`**, so row contents (hashes, `active` flags) were not queried directly.
2. The default documented password does **not** authenticate against production.
3. Accounts are only usable if operators know the password that was set at seed/rotate time (or reset via `pnpm create:staff`).
4. Separately, Clerk-based admin may work if `ADMIN_USER_IDS` or `profiles.staff_role` was configured on Render — that path was not enumerated here.

**Recommended ops action:** With Neon `DATABASE_URL`, run:

```bash
pnpm create:staff --username ceo --password '<new>' --role ceo
# repeat per role, or use seed-staff once to reset all seven
```

Then verify at `https://haulbrokr.com/admin/login`.

---

## Quick reference — auth stack for staff

```
Browser /admin/login
  → POST /api/admin/login
  → staff_users + scrypt verify
  → Set-Cookie: haulbrokr_staff=<HMAC session>
  → GET /api/admin/* with attachStaffSession
  → requirePermission(...)
```

Clerk is **not** in that chain. It only protects marketplace/customer routes and offers an alternate admin entry for Clerk identities with staff roles.
