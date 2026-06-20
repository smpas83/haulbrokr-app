# Migrating HaulBrokr to Cursor

This document is the complete handoff for moving this repository out of Replit and
working on it in **Cursor** (or any local environment). It describes the stack, how
to run, build, and deploy every piece, the full list of environment variables the
code actually reads, and the known caveats.

> **Naming note:** internal package/folder names still use the original `dumpbroker`
> identifier (e.g. `@workspace/dumpbroker`, mobile bundle id `com.dumpbroker.mobile`,
> URL scheme `dumpbroker`). These are intentionally left unchanged — renaming the
> mobile bundle identifier/scheme breaks the in-progress Apple Sign-In / code-signing
> setup. All user-facing branding is **HaulBrokr**.

---

## 1. Project overview

**HaulBrokr** is an "Uber for dump trucks" — a hauling marketplace that connects
customers who need material hauled with truck providers. It is a **pnpm monorepo**
containing several independently runnable apps ("artifacts") plus shared libraries.

| Path | Name | Kind | Stack |
|---|---|---|---|
| `artifacts/api-server` | `@workspace/api-server` | Backend API | Node + Express 5 + Drizzle ORM (TypeScript), bundled with esbuild |
| `artifacts/dumpbroker` | `@workspace/dumpbroker` | Marketing/web app | React 19 + Vite 7 + Tailwind CSS 4 |
| `artifacts/dumpbroker-mobile` | `@workspace/dumpbroker-mobile` | Mobile app (iOS + Android) | React Native + Expo (Expo Router) |
| `artifacts/dumpbroker-deck` | `@workspace/dumpbroker-deck` | Pitch deck (slides) | React + Vite |
| `artifacts/dumpbroker-promo` | `@workspace/dumpbroker-promo` | Promo video | React + Vite |
| `artifacts/mockup-sandbox` | `@workspace/mockup-sandbox` | Component preview (dev tooling) | React + Vite |

Shared libraries (`lib/*`):

| Path | Name | Purpose |
|---|---|---|
| `lib/db` | `@workspace/db` | PostgreSQL schema + Drizzle client |
| `lib/api-spec` | `@workspace/api-spec` | OpenAPI spec + Orval codegen config |
| `lib/api-zod` | `@workspace/api-zod` | Generated Zod schemas from the OpenAPI spec |
| `lib/api-client-react` | `@workspace/api-client-react` | Generated React Query hooks for the API |

---

## 2. Tech stack summary

- **Package manager:** pnpm (enforced — a `preinstall` guard blocks npm/yarn). Uses
  pnpm workspaces + a shared dependency catalog in `pnpm-workspace.yaml`.
- **Language/runtime:** TypeScript 5.9 on Node.js 24 (Node 20+ works).
- **Frontend (web/slides/promo/sandbox):** React 19, Vite 7, Tailwind CSS 4, Wouter
  (routing), TanStack Query.
- **Mobile:** React Native via Expo (Expo Router), single codebase → iOS + Android.
- **Backend:** Express 5, Drizzle ORM, Pino logging, Clerk for auth, Stripe for
  payments (with a mock mode), Resend for email.
- **Database:** PostgreSQL, schema managed with Drizzle Kit.
- **Validation/codegen:** Zod, OpenAPI + Orval.

---

## 3. Database

PostgreSQL accessed through Drizzle ORM.

- **Schema source of truth:** `lib/db/src/schema/` (each table in its own file,
  re-exported from `lib/db/src/schema/index.ts`).
- **Client:** `lib/db/src/index.ts` (a `pg` Pool + `drizzle()` instance; requires
  `DATABASE_URL`).
- **Drizzle config:** `lib/db/drizzle.config.ts`.

Tables defined in the schema:

`profiles`, `organizations`, `trucks`, `requests`, `bids`, `jobs`, `activity`,
`w9`, `insurance`, `payment`, `payout`, `dump_sites`, `bin_orders`, `projects`,
`factoring`, `delivery_evidence`, `dot_cdl`, `quickbooks`, `tickets`,
`driver_docs`, `credit_applications`, `job_status_updates`, `project_assignments`,
`ratings`, `job_messages`, `upload_sessions`.

Apply the schema to your database (dev — pushes the schema directly, no migration
files):

```bash
pnpm --filter @workspace/db run push
# or, to drop/recreate when prompted without interactive confirmation:
pnpm --filter @workspace/db run push-force
```

---

## 4. Environment variables (names only — never commit values)

Set these in your shell, your hosting provider's secret manager, or a local `.env`
(which is git-ignored). **No `.env` file or secret values are included in this repo.**

### Backend — `artifacts/api-server`
| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | yes (auth) | Clerk backend secret key |
| `CLERK_PUBLISHABLE_KEY` | yes (auth) | Clerk publishable key (used for proxy host key derivation) |
| `ADMIN_USER_IDS` | optional | Comma-separated Clerk user IDs granted admin access |
| `PAYMENTS_MOCK_MODE` | optional | `"true"` uses a mock Stripe client instead of the real one |
| `UPLOAD_TOKEN_SECRET` | yes (uploads) | Secret used to sign/verify temporary upload tokens |
| `TICKET_QR_SECRET` | yes (tickets) | Secret used to sign/verify ticket QR codes |
| `PRIVATE_OBJECT_DIR` | object storage | Path/prefix for private object storage |
| `PUBLIC_OBJECT_SEARCH_PATHS` | object storage | Comma-separated public object search paths |
| `LOG_LEVEL` | optional | Pino log level (`info`, `debug`, …) |
| `PORT` | yes | Port the API server listens on |
| `NODE_ENV` | optional | `development` / `production` / `test` |
| `REPLIT_DEPLOYMENT` | Replit-only | Set to `"1"` in a Replit deployment; used to detect production |

> **Stripe:** real Stripe keys are not read directly from the environment in code —
> on Replit they are provided through the Stripe integration / `stripe-replit-sync`.
> Off Replit, wire the real Stripe secret key into `src/.../stripeClient.ts` (or keep
> `PAYMENTS_MOCK_MODE=true` to run without live payments).
>
> **Resend (email):** delivered through the Replit Connectors hostname on Replit. Off
> Replit, supply a Resend API key in `src/.../resendClient.ts`.

### Web app — `artifacts/dumpbroker`
| Variable | Purpose |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the browser |
| `VITE_CLERK_PROXY_URL` | Clerk proxy URL (used to route Clerk via the API) |
| `BASE_PATH` | Base path prefix (defaults to `/`; injected at serve time on Replit) |
| `PORT` | Vite dev/preview server port |

### Mobile app — `artifacts/dumpbroker-mobile`
| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the app |
| `EXPO_PUBLIC_DOMAIN` | Domain used to build the API base URL (`https://<domain>/api`) |
| `EXPO_PUBLIC_REPL_ID` | Environment identifier (Replit-specific; safe to omit off Replit) |
| `METRO_PORT` / `RCT_METRO_PORT` | Metro bundler port |
| `PORT` | Expo dev server port |

### Slides / promo / sandbox (`dumpbroker-deck`, `dumpbroker-promo`, `mockup-sandbox`)
| Variable | Purpose |
|---|---|
| `PORT` | Vite dev/preview server port |
| `BASE_PATH` | Base path prefix for static asset routing |

> Replit-only variables (`REPLIT_DEPLOYMENT`, `REPLIT_DEV_DOMAIN`,
> `REPLIT_INTERNAL_APP_DOMAIN`, `EXPO_PUBLIC_REPL_ID`) are read defensively and are not
> required off Replit. When absent, the code falls back to local/dev behavior.

---

## 5. Authentication setup

Auth is handled by **Clerk** across all three runtimes (backend, web, mobile).

- **Backend (`api-server`):** uses `@clerk/express`. `clerkMiddleware` is mounted in
  `src/app.ts` and derives the publishable key from the incoming host
  (`publishableKeyFromHost`), with `CLERK_PUBLISHABLE_KEY` as the fallback; requests are
  authenticated from the Clerk session token. A custom **Clerk proxy** middleware
  (`src/middlewares/clerkProxyMiddleware.ts`, mounted at `CLERK_PROXY_PATH`) lets the
  browser reach Clerk through the API origin. The health check (`/api/healthz`) is mounted
  *before* the Clerk middleware so deploy probes succeed even when Clerk keys are absent.
  Requires `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`.
- **Admin authorization:** there is no separate admin provider — admin access is granted by
  listing Clerk user IDs in `ADMIN_USER_IDS` (comma-separated). It is secure-by-default in
  production (no IDs ⇒ no admins) and falls back to an open `cto` role in development.
  Per-role staff permissions (ap / ar / cfo / cto) are enforced centrally in
  `requireAdmin.ts`.
- **Web (`dumpbroker`):** wraps the app in Clerk's React provider in `src/AuthShell.tsx`,
  configured with `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PROXY_URL` (routes Clerk
  traffic through the API proxy above).
- **Mobile (`dumpbroker-mobile`):** uses `@clerk/expo` with a secure token cache; the
  provider is configured in `app/_layout.tsx` / `context/ClerkAuthContext.tsx` from
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- **Getting keys:** on Replit these came from the Replit-managed Clerk integration. Off
  Replit, create your own Clerk application at clerk.com → **API Keys**, and set the
  publishable/secret keys above.

---

## 6. Third-party integrations

| Service | Used for | Wired in |
|---|---|---|
| **Clerk** | Authentication (see §5) | `@clerk/express`, `@clerk/clerk-react`, `@clerk/expo` |
| **Stripe** | Payments + Connect payouts (has a mock mode) | `artifacts/api-server/src/lib/stripeClient.ts` |
| **Resend** | Transactional email (e.g. payout alerts) | `artifacts/api-server/src/lib/resendClient.ts` |
| **Object storage** | Document/file uploads (W-9, insurance, delivery evidence, driver docs) | `artifacts/api-server/src/lib/objectStorage.ts` |
| **Google Maps** | Mobile map UI | `react-native-maps` via `artifacts/dumpbroker-mobile/lib/maps.ts` |

**Important — Replit Connectors:** on Replit, **Stripe** and **Resend** credentials are
fetched at runtime from the Replit Connectors proxy (`REPLIT_CONNECTORS_HOSTNAME` plus a
repl/deploy identity token), *not* from plain env vars. Those client modules request fresh
keys on every call (tokens expire — the clients are intentionally never cached).

Off Replit you must replace that lookup:

- **Stripe** (`stripeClient.ts`): provide a real secret key (e.g. from a `STRIPE_SECRET_KEY`
  env var) where `getCredentials()` calls the connector, **or** set `PAYMENTS_MOCK_MODE=true`
  to run on the built-in mock client (simulated, always-successful payments — no real money
  moves). Note: in a production deployment a connector *lookup error* fails closed (it
  refuses to silently fall back to mock), so wire real keys before going live.
- **Resend** (`resendClient.ts`): provide `api_key` + `from_email` (e.g. `RESEND_API_KEY` /
  `RESEND_FROM_EMAIL`) in place of the connector lookup. Email is best-effort; the app runs
  without it.
- **Object storage**: backed by Replit App Storage (GCS-compatible) via `PRIVATE_OBJECT_DIR`
  and `PUBLIC_OBJECT_SEARCH_PATHS`. Off Replit, point these at your own bucket + credentials.
- **Google Maps**: `react-native-maps` uses Apple Maps on iOS by default; for the Google
  provider (and Android), add a Google Maps API key to the native config in `app.json`.

---

## 7. Running locally

### Prerequisites
- **Node.js 24** (or 20+)
- **pnpm** — `npm install -g pnpm`
- **PostgreSQL 14+** (local or hosted), reachable via `DATABASE_URL`
- For mobile: the **Expo Go** app for a quick preview, or an **Expo/EAS** account for
  real device builds.

### Install
```bash
pnpm install
```

### Push the DB schema
```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/haulbrokr
pnpm --filter @workspace/db run push
```

### Start each app (dev)
Each command runs one artifact. Set `PORT` to any free port you like.

```bash
# Backend API
PORT=5000 pnpm --filter @workspace/api-server run dev

# Web app
PORT=5173 pnpm --filter @workspace/dumpbroker run dev

# Pitch deck
PORT=4173 pnpm --filter @workspace/dumpbroker-deck run dev

# Promo video
PORT=4174 pnpm --filter @workspace/dumpbroker-promo run dev

# Component sandbox (dev tooling)
PORT=8081 pnpm --filter @workspace/mockup-sandbox run dev

# Mobile (Expo) — then scan the QR with Expo Go
PORT=8082 pnpm --filter @workspace/dumpbroker-mobile run dev
```

> The `dev` script for the mobile app only applies the Replit-specific
> `REPLIT_*` / `EXPO_*` overrides when those Replit variables are present, so the
> same command works off Replit. Locally, copy the example env file and fill it in
> — Expo loads `.env` automatically and the `dev` command falls back to those
> values:
> ```bash
> cd artifacts/dumpbroker-mobile
> cp .env.example .env          # set EXPO_PUBLIC_DOMAIN + EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
> pnpm run dev                  # or: PORT=8082 pnpm run dev
> ```

---

## 8. Building & type-checking

```bash
pnpm run typecheck   # typecheck shared libs (tsc --build) then every artifact
pnpm run build       # typecheck, then build every package that has a build script
```

Per-artifact builds (run from the repo root):
```bash
pnpm --filter @workspace/api-server run build      # esbuild bundle → dist/
pnpm --filter @workspace/dumpbroker run build      # Vite build + prerender
pnpm --filter @workspace/dumpbroker-mobile run build
```

Regenerate API hooks / Zod schemas after editing the OpenAPI spec:
```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## 9. Deploying

This is a pnpm monorepo, so a deploy generally means deploying each artifact to a
target that suits it:

- **API server** (`api-server`): builds to a single `dist/index.mjs` (esbuild) and
  runs with `node dist/index.mjs`. Deploy to any Node host (Render, Fly, Railway, a
  container, etc.). It listens on `PORT` and needs the backend env vars above.
- **Web / slides / promo** (Vite apps): `pnpm --filter <name> run build` produces a
  static `dist/`. Host on any static host/CDN (Vercel, Netlify, Cloudflare Pages,
  S3+CloudFront). Set `BASE_PATH` if not served from the domain root.
- **Mobile** (`dumpbroker-mobile`): build installable/store binaries with EAS:
  ```bash
  cd artifacts/dumpbroker-mobile
  npx eas build --platform ios     # or android, or all
  npx eas submit --platform ios    # to submit to the stores
  ```
  Config lives in `app.json` (icon, splash, bundle id, permissions) and `eas.json`.

### Mapping Replit-specific config to a non-Replit environment
- **Workflows** (`.replit` `[workflows]`): these are just named shell commands Replit
  runs. The equivalents are the `pnpm --filter ... run dev` commands above (and the
  `test` / `webbuild` validation commands). There is nothing to migrate beyond running
  those commands yourself / in CI.
- **Ports** (`.replit` `[[ports]]`): Replit maps internal ports to external ones.
  Off Replit, just pick ports via the `PORT` env var per app. The `test` harness
  (`scripts/test-with-ports.mjs`) intentionally holds the canonical dev-server ports
  busy while tests run — this is why the dev-server workflows show "port in use" while
  validation is running; it is expected, not a bug.
- **Integrations** (`.replit` `[agent] integrations`, Replit Connectors): Stripe and
  Resend are wired through Replit's integration/connector system on Replit. Off Replit,
  provide their API keys directly to the respective client modules (see §4 notes).
- **Deployment target** (`.replit` `[deployment]` = autoscale, router = application):
  replace with your host's equivalent (autoscaling web service for the API, static
  hosting for the web bundles).

---

## 10. Known issues / caveats

- **pnpm only.** A `preinstall` guard deletes `package-lock.json`/`yarn.lock` and
  refuses non-pnpm installs. Always use pnpm.
- **`dumpbroker` naming retained.** See the note at the top — do not rename the mobile
  bundle id/scheme; it is tied to Apple Sign-In / code signing.
- **Expo Go stale icon.** The launcher icon (`assets/images/app-icon-v2.png`) and
  splash are baked in at build time. In the Expo Go dev launcher the icon can look
  cached/stale — that is an Expo Go quirk, not a code bug; a real EAS build always
  shows the correct icon.
- **`packageExtensions` workarounds** (`pnpm-workspace.yaml`): two pnpm-specific fixes
  are required and documented inline there — injecting `@babel/generator` into
  `react-native-worklets`, and pinning `@hookform/resolvers` to zod v3. Keep these if
  you stay on pnpm.
- **Web-runtime guard test** (`dumpbroker-mobile` `check-web-runtime`): a heavy
  headless-Chromium E2E check. It can time out when run in parallel with the `webbuild`
  validation (both launch Chromium). The `webbuild` validation is the authoritative
  "does the web bundle render" check.
- **`react-native-maps` / native modules.** If an EAS build fails on pod install,
  native module versions are likely off the Expo SDK — fix with `expo install --fix`.

---

## 11. Current unfinished / in-flight work

Open and proposed work at the time of this handoff (context for the new environment):

- Notify carriers/customers when an application is approved or rejected; allow admins
  to add a rejection-reason note.
- Mobile: let providers find and bid on open loads; let customers edit/cancel a posted
  load; let providers mark a live haul complete; let providers manage their trucks.
- Show real payment data (not demo numbers) on the mobile job screen; surface
  failed-payment alerts inside the mobile app.
- Payout reliability: keep payout status current without opening the app; alert
  providers when a completed-job payout is delayed; show a stuck-payouts badge on the
  Account tab; record who reset a payout's alerts and why.
- Payments hardening: prevent double-charging a job; ensure a saved card works on the
  first charge; handle the window while a bank (ACH) payment is still clearing; keep
  the web payout-setup screen fresh while Stripe reviews.
- Admin: alert when reviews pile up; confirm web staff can approve/reject applications
  cleanly.
- Marketing: a launch promo video for the app stores and website.
- Tooling: automatic type-error checking on every change.

See the repo's task list / `DEVELOPER_HANDOFF.md` for additional context.
