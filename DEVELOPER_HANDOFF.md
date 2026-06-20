# HaulBrokr — Developer Handoff

Complete source for **HaulBrokr** (haulbrokr.com), an "Uber-for-dump-trucks" hauling
marketplace. This is a **pnpm monorepo** containing the web app, the mobile app
(iOS + Android from one Expo codebase), the backend API, a pitch deck, and shared
libraries.

> Note: internal package/folder names still use the original `dumpbroker` identifier
> (e.g. `@workspace/dumpbroker`, bundle id `com.dumpbroker.mobile`, URL scheme
> `dumpbroker`). These are intentionally left unchanged because renaming the mobile
> bundle identifier/scheme breaks the in-progress Apple Sign-In / code-signing setup.
> All user-facing branding is **HaulBrokr**.

---

## 1. Prerequisites

- **Node.js 24** (or 20+)
- **pnpm** (this repo enforces pnpm — npm/yarn are blocked by a `preinstall` guard)
  ```bash
  npm install -g pnpm
  ```
- **PostgreSQL** database (any Postgres 14+; local or hosted)
- For mobile: the **Expo Go** app on a phone (quick preview) or an **Expo / EAS**
  account for real iOS/Android builds — see https://docs.expo.dev/build/setup/

## 2. Install

From the repo root:
```bash
pnpm install
```

## 3. Environment variables

Create the secrets your environment needs (these are NOT included in this archive
for security). Set them in your shell / hosting provider / a local `.env`:

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api-server | Postgres connection string (required) |
| `STRIPE_SECRET_KEY` | api-server | Stripe payments (if using checkout) |
| `CLERK_SECRET_KEY` / `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | mobile auth | Clerk auth keys |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | object storage | File uploads |

Check each artifact's source for the exact variable names it reads (search for
`process.env` / `EXPO_PUBLIC_`).

## 4. Database

```bash
pnpm --filter @workspace/db run push     # push schema to your DATABASE_URL (dev)
```

## 5. Run each piece (dev)

| What | Command | Notes |
|---|---|---|
| **Backend API** | `pnpm --filter @workspace/api-server run dev` | Express + Drizzle |
| **Website** | `pnpm --filter @workspace/dumpbroker run dev` | React + Vite |
| **Mobile (iOS + Android)** | `pnpm --filter @workspace/dumpbroker-mobile run dev` | Expo; open in Expo Go |
| **Pitch deck** | `pnpm --filter @workspace/dumpbroker-deck run dev` | Slides |

Each dev server reads a `PORT` env var (assigned automatically on Replit; set your
own when running elsewhere).

## 6. Build / typecheck

```bash
pnpm run typecheck        # typecheck every package
pnpm run build            # typecheck + build all
```

## 7. iOS & Android builds

The mobile app is a single Expo project (`artifacts/dumpbroker-mobile`) that targets
both platforms.
- **Quick preview:** run the mobile dev command above, then scan the QR with Expo Go.
- **Installable / store builds:** use EAS:
  ```bash
  cd artifacts/dumpbroker-mobile
  npx eas build --platform ios        # or android, or all
  ```
  Config: `app.json` (icon, splash, bundle id, permissions) and `eas.json`.

### App icon note
The launcher/app icon (`assets/images/app-icon-v2.png`) and splash
(`assets/images/haulbrokr-logo.png`) are baked in at **build time**. In the Expo Go
dev launcher the icon can appear cached/stale — that is an Expo Go quirk, not a code
bug; a real EAS build always shows the correct icon.

## 8. Repo map

```
artifacts/
  dumpbroker/          # Website (React + Vite)
  dumpbroker-mobile/   # Mobile app (Expo → iOS + Android)
  dumpbroker-deck/     # Pitch deck (slides)
  api-server/          # Backend API (Express + Drizzle + Postgres)
  mockup-sandbox/      # Component preview workspace (dev tooling)
packages/ (or libs/)   # Shared code: DB schema, API spec/codegen, shared UI/types
attached_assets/       # Original brand assets (HaulBrokr logo source files)
```

## 9. Brand assets

Original logo source files are in `attached_assets/` (`haulbrokr-logo.png`,
`haulbrokr-icon.png`). Derived icons/favicons live in each artifact's
`public/` or `assets/images/` folder.

---

Excluded from this archive (regenerated, not needed): `node_modules/`, build output
(`dist/`), Expo cache (`.expo/`), and all secrets/`.env` files.
