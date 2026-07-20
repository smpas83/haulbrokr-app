# HaulBrokr Operator Runbook — Closed Beta GO

**Release commit:** `4ab8887` (PR #97 + PR #98 merged)  
**Engineering status:** FROZEN — no new features, UI changes, or refactors.  
**Audience:** Non-engineer operators with dashboard access to GitHub, Stripe, Render, Vercel, Neon, Cloudflare, Resend, Expo/EAS, Apple, Google Play, and Google Cloud.

Use this document top-to-bottom. Each section is self-contained. Do not skip credential steps — the release agent cannot complete them without your secrets.

---

## Quick start — do these first

| Priority | Action | Section |
|----------|--------|---------|
| P0 | Confirm Render + Vercel are deployed from commit `4ab8887` | §3 Render, §4 Vercel |
| P0 | Enable Stripe refund webhook events | §2 Stripe |
| P0 | Run production smoke script | §3 Render (verify) |
| P1 | Complete authenticated E2E checklist | §3–§7 (all services) |
| P1 | Build + submit mobile to TestFlight / Play internal | §8 Expo, §9 Apple, §10 Google Play |
| P2 | Set GitHub `EXPO_TOKEN` for CI builds | §1 GitHub Secrets |
| P2 | Rotate staff default passwords | §3 Render |

---

## 1. GitHub Secrets

### Purpose
Store credentials used by GitHub Actions (primarily the mobile TestFlight workflow). Without these, iOS builds must be triggered manually from a machine with `eas` CLI and `EXPO_TOKEN`.

### Dashboard
**GitHub → Repository → Settings → Secrets and variables → Actions**

### URL
`https://github.com/smpas83/haulbrokr/settings/secrets/actions`  
(Replace org/repo if your fork differs.)

### Steps

1. Open the URL above (requires repo **Admin** or **Maintain** role).
2. Click **New repository secret**.
3. Create:

| Secret name | Value source | Required for |
|-------------|--------------|--------------|
| `EXPO_TOKEN` | Expo dashboard → Account Settings → Access Tokens → **Create** | `.github/workflows/mobile-testflight.yml` |

4. Optional (only if automating deploys from Actions):

| Secret name | Value source |
|-------------|--------------|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel project → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General |
| `RENDER_API_KEY` | Render → Account Settings → API Keys |
| `RENDER_SERVICE_ID` | Render service → Settings → Service ID |

### Terminal commands (verify secret works locally)

```bash
# On your laptop with EXPO_TOKEN exported:
cd artifacts/haulbrokr-mobile
pnpm exec eas whoami
```

**Expected output:**
```
Logged in as <your-expo-username>
```

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `eas whoami` → `Not logged in` | Token missing or expired | Create new token in Expo; update GitHub secret |
| Workflow fails at `eas build` | `EXPO_TOKEN` not set in repo secrets | Add secret; re-run workflow from Actions tab |
| `403` on workflow | Insufficient GitHub permissions | Ask repo owner to add secret |

### Recovery
1. Revoke old Expo token in Expo dashboard.
2. Create new token with **Read and write** scope.
3. Update GitHub secret `EXPO_TOKEN`.
4. Actions → **Mobile TestFlight** → **Re-run all jobs**.

---

## 2. Stripe Dashboard

### Purpose
Configure live (or test-mode staging) payments, Connect onboarding, and refund webhook events. Refund endpoints are deployed; webhook events for refunds are **not auto-enabled** without operator action.

### Dashboard
**Stripe Dashboard → Developers**

### URL
- Test mode: `https://dashboard.stripe.com/test/dashboard`
- Live mode: `https://dashboard.stripe.com/dashboard`

### Steps — API keys

1. Toggle **Test mode** ON for staging; OFF for production.
2. Go to **Developers → API keys**.
3. Copy:
   - **Publishable key** → Render `STRIPE_PUBLISHABLE_KEY`, Vercel (if needed client-side)
   - **Secret key** → Render `STRIPE_SECRET_KEY` (click **Reveal**)
4. Confirm `PAYMENTS_MOCK_MODE` is **not set** on Render.

### Steps — Connect

1. **Connect → Settings**.
2. Enable **Express** accounts for providers.
3. Set branding and redirect URLs to `https://haulbrokr.com`.

### Steps — Webhook endpoint

1. **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://haulbrokr-api.onrender.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `account.updated`
   - `charge.refunded` ← **required for refunds**
   - `refund.created` ← **required for refunds**
   - `refund.updated` ← **required for refunds**
4. Click **Add endpoint**.
5. Click the endpoint → **Signing secret** → **Reveal** → copy to Render `STRIPE_WEBHOOK_SECRET`.

### Steps — Auto-enable refund events (alternative)

From a machine with the live secret key:

```bash
cd /path/to/haulbrokr
STRIPE_SECRET_KEY=sk_live_... node scripts/go-live-stripe-refunds.mjs
```

**Expected output:**
```
OK: /api/admin/jobs/1/refund reachable (HTTP 401)
OK: /api/admin/jobs/1/payment-history reachable (HTTP 401)
OK: /api/readyz healthy (includes refund schema after auto-migration deploy)
OK: Webhook we_... enabled events: ..., charge.refunded, refund.created, refund.updated
```

### Steps — Refund smoke test (production)

1. Sign in at `https://haulbrokr.com/admin/login` as staff with **payouts** permission.
2. Open Admin → Payouts → select a paid job.
3. Issue a small partial refund (or use API):

```bash
curl -X POST "https://haulbrokr.com/api/admin/jobs/<JOB_ID>/refund" \
  -H "Cookie: <staff-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1.00, "reason": "requested_by_customer"}'
```

4. Stripe Dashboard → **Payments** → confirm refund row.
5. Stripe Dashboard → **Developers → Webhooks** → confirm `refund.created` delivery **Succeeded**.

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Webhook returns 400 unsigned | Correct — signature required | Use Stripe **Send test webhook** with signing secret |
| Charges fail with `invalid_api_key` | Wrong mode (test vs live) | Match Stripe mode to Render keys |
| Refund API 401 | Not logged in as staff | Use `/admin/login` staff session |
| Refund persists but job status stale | Refund webhook events missing | Enable events per above; replay from Stripe webhook log |
| Connect onboarding loop | Redirect URL mismatch | Stripe Connect settings → add `https://haulbrokr.com` |

### Recovery
1. Stripe → Webhooks → endpoint → **Roll signing secret** only if compromised.
2. Update Render `STRIPE_WEBHOOK_SECRET`.
3. **Redeploy** Render service (Environment → Manual Deploy).
4. Stripe → Webhooks → **Resend** failed events.

---

## 3. Render

### Purpose
Host the Express API (`haulbrokr-api`). Database migrations run automatically on boot via `startupMigrations.ts`.

### Dashboard
**Render Dashboard → Services → haulbrokr-api**

### URL
`https://dashboard.render.com/`

### Steps — Confirm deployment

1. Open service **haulbrokr-api**.
2. **Events** tab → confirm latest deploy is from commit `4ab8887` (or later on `master`).
3. If stale: **Manual Deploy → Deploy latest commit**.
4. **Logs** tab → confirm no startup env validation errors.

### Steps — Environment variables

1. Service → **Environment**.
2. Verify all variables from `ENVIRONMENT_INVENTORY.md` (API / Render section) are set.
3. Critical checklist:

| Variable | Must be |
|----------|---------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled URL with `?sslmode=require` |
| `PAYMENTS_MOCK_MODE` | unset or `false` |
| `STRIPE_SECRET_KEY` | `sk_live_...` (production) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STAFF_AUTH_SECRET` | 32+ chars (auto-generated OK) |
| `ADMIN_USER_IDS` | Clerk user IDs, comma-separated |

4. Click **Save Changes** → triggers redeploy.

### Steps — Staff seed + password rotation

```bash
export DATABASE_URL="postgres://...-pooler...?sslmode=require"
STAFF_DEFAULT_PASSWORD='YourSecureProductionPassword!' \
  pnpm --filter @workspace/api-server run seed-staff
```

**Expected output:** Lines confirming staff users `ceo`, `president`, `cto`, etc. created or updated.

Then:
1. Visit `https://haulbrokr.com/admin/login`.
2. Sign in as `ceo` with the password above.
3. **Immediately change password** (or update DB row — re-seed only on empty DB).

### Terminal — production smoke

```bash
WEB_URL=https://haulbrokr.com API_DIRECT=https://haulbrokr-api.onrender.com \
  ./scripts/verify-production.sh
```

**Expected output:**
```
OK: Render /api/readyz
OK: Vercel /api/readyz proxy
OK: Homepage HTTP 200
OK: /admin/login HTTP 200
OK: /api/admin/access anonymous gate
All automated checks passed.
```

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `/api/readyz` 503 or DB error | Bad `DATABASE_URL` | Use Neon **pooled** URL; confirm `sslmode=require` |
| Cold start 30s delay | Starter plan spin-down | First request after idle is slow; upgrade plan or accept |
| Env validation crash on boot | Missing required var | Check Render logs; fill per `validateProductionEnv.ts` |
| CORS errors from web | Missing origin | Set `CORS_ALLOWED_ORIGINS=https://haulbrokr.com,https://www.haulbrokr.com` |

### Recovery
1. **Rollback:** Render → service → **Deploys** → previous green deploy → **Rollback**.
2. Record incident in launch log per `ROLLBACK_CHECKLIST.md`.

---

## 4. Vercel

### Purpose
Host the React web app at `haulbrokr.com` and proxy `/api/*` to Render.

### Dashboard
**Vercel → haulbrokr project**

### URL
`https://vercel.com/dashboard`

### Steps — Confirm deployment

1. Open project → **Deployments**.
2. Production deployment should reference commit `4ab8887` on `master`.
3. If stale: **⋯ → Redeploy** on latest `master` deployment.

### Steps — Environment variables (Production)

1. Project → **Settings → Environment Variables**.
2. Set:

| Variable | Value |
|----------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` from Clerk |
| `VITE_CLERK_PROXY_URL` | `/api/__clerk` |

3. **Redeploy** after changing (env vars are baked at build time).

### Steps — Domains + DNS

1. Project → **Settings → Domains**.
2. Confirm `haulbrokr.com` and `www.haulbrokr.com` show **Valid Configuration**.
3. If not: add DNS records at your registrar per Vercel instructions.

### Steps — Verify proxy rewrite

`vercel.json` at repo root rewrites `/api/:path*` → `https://haulbrokr-api.onrender.com/api/:path*`.

```bash
curl -s https://haulbrokr.com/api/readyz
```

**Expected output:** `{"status":"ok"}`

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `/api/readyz` 502 | Render API down | Fix Render first |
| Clerk sign-in fails | Wrong publishable key or domain | Clerk domains + redeploy Vercel with correct `VITE_CLERK_*` |
| Geolocation blocked | Permissions-Policy | Already fixed in `vercel.json`: `geolocation=(self)` |
| Old assets cached | CDN cache | Hard refresh; check deployment timestamp |

### Recovery
1. Vercel → Deployments → previous successful → **Promote to Production**.
2. Do not roll back database schema without tested migration.

---

## 5. Neon

### Purpose
Production Postgres database. Schema is pushed manually once; refund/device_tokens tables also auto-migrate on API boot.

### Dashboard
**Neon Console → Project haulbrokr-prod**

### URL
`https://console.neon.tech/`

### Steps

1. Open project → **Connection Details**.
2. Copy **Pooled connection** string (hostname contains `-pooler`).
3. Append `?sslmode=require` if missing.
4. Paste into Render `DATABASE_URL`.

### Terminal — initial schema push (one-time or after schema change)

```bash
export DATABASE_URL="postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/haulbrokr?sslmode=require"
pnpm --filter @workspace/db run push
```

**Expected output:** Drizzle push completes without errors.

### Terminal — verify refund tables exist

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM payment_refunds;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM device_tokens;"
```

**Expected output:** Query succeeds (count may be `0`).

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `SSL required` | Missing `sslmode=require` | Add to connection string |
| Connection timeout from Render | Using direct (non-pooled) URL | Switch to pooled endpoint |
| `relation does not exist` | Schema not pushed | Run `db push`; or redeploy API (startup migrations) |

### Recovery
1. Neon → **Branches** → create backup branch before destructive changes.
2. **Do not** roll back schema after production writes without tested down migration (`ROLLBACK_CHECKLIST.md`).

---

## 6. Cloudflare R2

### Purpose
Store compliance documents, job photos, and scale tickets.

### Dashboard
**Cloudflare Dashboard → R2**

### URL
`https://dash.cloudflare.com/ → R2 Object Storage`

### Steps

1. **R2 → Create bucket** (if not exists) — e.g. `haulbrokr-uploads`.
2. **Manage R2 API Tokens → Create API token** with Object Read & Write on that bucket.
3. Copy credentials to Render:

| Variable | Value |
|----------|-------|
| `R2_ACCOUNT_ID` | Cloudflare account ID (right sidebar) |
| `R2_ACCESS_KEY_ID` | From API token |
| `R2_SECRET_ACCESS_KEY` | From API token |
| `R2_BUCKET` | Bucket name |
| `R2_PUBLIC_URL` | Public/custom domain URL (e.g. `https://cdn.haulbrokr.com`) |
| `PRIVATE_OBJECT_DIR` | `/haulbrokr/private` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | `/haulbrokr/public` |

4. **R2 → bucket → Settings → Public access** or connect custom domain for `R2_PUBLIC_URL`.

### Smoke test

1. Complete a driver photo upload in staging/production.
2. Confirm admin can view the private object (authorized).
3. Upload a test public object; confirm `R2_PUBLIC_URL` returns HTTP 200.

```bash
curl -sI "https://<your-r2-public-domain>/test.txt" | head -5
```

**Expected output:** `HTTP/2 200` or `404` (not `5xx`).

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Upload fails 500 | Bad R2 credentials | Regenerate token; update Render |
| Public URL 403 | Bucket not public / domain not linked | Configure public access or custom domain |
| Private doc visible without auth | ACL misconfiguration | Check `PRIVATE_OBJECT_DIR` prefix |

### Recovery
1. Rotate R2 API token.
2. Update Render secrets.
3. Redeploy API.

---

## 7. Resend

### Purpose
Transactional email (job notifications, compliance reminders).

### Dashboard
**Resend Dashboard → Domains**

### URL
`https://resend.com/domains`

### Steps

1. **Add Domain** → enter `haulbrokr.com`.
2. Resend shows DNS records (SPF, DKIM, etc.).
3. Add records at your DNS registrar (same place as Vercel DNS).
4. Wait for **Verified** status in Resend.
5. **API Keys → Create API Key** → copy to Render `RESEND_API_KEY`.
6. Set Render `RESEND_FROM_EMAIL=noreply@haulbrokr.com` (must match verified domain).

### Smoke test

Trigger an action that sends email (e.g. compliance approval, job notification) and confirm delivery in Resend **Logs**.

```bash
# Optional: verify API key (from machine with key)
curl -s https://api.resend.com/domains \
  -H "Authorization: Bearer re_..." | head -c 200
```

**Expected output:** JSON listing domains with `"status":"verified"`.

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Domain stuck **Pending** | DNS not propagated | Wait 24–48h; verify records with `dig` |
| Email bounces | Unverified sender | Use address on verified domain |
| 401 from API | Bad `RESEND_API_KEY` | Regenerate key; update Render |

### Recovery
1. Resend → Domains → **Restart verification**.
2. Update Render `RESEND_API_KEY`.
3. Redeploy API.

---

## 8. Expo / EAS

### Purpose
Build and distribute the mobile app (`com.haulbrokr.mobile`).

### Dashboard
**Expo → Project dumpbroker-mobile**

### URL
`https://expo.dev/accounts/<account>/projects/dumpbroker-mobile`

### Steps — Project secrets

```bash
cd artifacts/haulbrokr-mobile
eas secret:create --scope project --name EXPO_PUBLIC_DOMAIN --value haulbrokr.com
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_...
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value AIza...
```

### Steps — Push notifications (required for delivery)

1. Expo project → **Credentials**.
2. **iOS → Push Notifications** → upload APNs key or let EAS manage.
3. **Android → FCM** → upload `google-services.json` / FCM server key per Expo docs.

### Steps — Build

```bash
cd artifacts/haulbrokr-mobile
eas build --platform ios --profile production --non-interactive
eas build --platform android --profile production --non-interactive
```

**Expected output:** Build URLs; final status **FINISHED**.

### Steps — Submit

```bash
eas submit --platform ios --profile production --latest --non-interactive
eas submit --platform android --profile production --latest --non-interactive
```

`eas.json` references:
- iOS ASC App ID: `6769841431`
- Android service account: `./google-service-account.json` (must exist locally; gitignored)

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Build fails on maps | Missing `GOOGLE_MAPS_API_KEY` secret | Add EAS secret; rebuild |
| Push not received | APNs/FCM not configured | Complete Credentials in Expo dashboard |
| API unreachable from app | Wrong domain | `EXPO_PUBLIC_DOMAIN=haulbrokr.com` (no `https://`) |
| Android submit fails | Missing `google-service-account.json` | Create in Google Play Console (§10) |

### Recovery
1. `eas build:list` → identify failed build → view logs.
2. Fix secrets → rebuild.
3. For CI: ensure GitHub `EXPO_TOKEN` is set (§1).

---

## 9. Apple App Store Connect

### Purpose
Distribute iOS Closed Beta via TestFlight.

### Dashboard
**App Store Connect → My Apps → HaulBrokr**

### URL
`https://appstoreconnect.apple.com/apps/6769841431`

### Steps

1. Confirm app exists with bundle ID `com.haulbrokr.mobile`.
2. **TestFlight** tab → wait for build from EAS submit to appear (processing 10–30 min).
3. **Internal Testing** → add testers (up to 100).
4. **External Testing** (Closed Beta):
   - Create group → add build → submit **Beta App Review**.
   - Fill export compliance (app sets `ITSAppUsesNonExemptEncryption: false`).
5. **App Privacy** → complete data collection questionnaire.
6. **App Information** → verify support URL `https://haulbrokr.com/support`.

### Apple Sign-In (Clerk)

1. Apple Developer → **Certificates, Identifiers & Profiles → Identifiers → com.haulbrokr.mobile**.
2. Enable **Sign In with Apple**.
3. Clerk Dashboard → **SSO → Apple** → paste Service ID / key per Clerk docs.

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| Build stuck "Processing" | Apple server delay | Wait; check email for compliance issues |
| Beta review rejected | Missing privacy policy | Ensure `https://haulbrokr.com/privacy` is live |
| Sign in with Apple fails | Clerk/Apple misconfiguration | Re-link in Clerk + Apple Developer |

### Recovery
1. App Store Connect → **Activity** → view rejection reason.
2. Fix metadata; upload new build if binary issue.

---

## 10. Google Play Console

### Purpose
Distribute Android Closed Beta (internal or closed track).

### Dashboard
**Google Play Console → HaulBrokr**

### URL
`https://play.google.com/console/`

### Steps — Service account (for EAS submit)

1. Play Console → **Setup → API access**.
2. **Link** Google Cloud project (or create).
3. **Create service account** → grant **Release manager** (or admin) on the app.
4. Download JSON key → save as `artifacts/haulbrokr-mobile/google-service-account.json` (never commit).
5. Play Console → **Users and permissions** → invite service account email.

### Steps — Closed Beta track

1. **Testing → Closed testing** → Create track.
2. Add tester email list (Google Groups or individual emails).
3. Upload build via `eas submit` or Play Console upload.
4. **Release → Review and roll out**.

### Steps — Store listing minimum

- App name, short description, screenshots (see `appstore-screenshots/` in repo for reference assets).
- Privacy policy URL: `https://haulbrokr.com/privacy`
- Content rating questionnaire.

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `eas submit` permission denied | Service account not granted | Play Console → API access → grant app permission |
| Maps blank on Android | API key not restricted to `com.haulbrokr.mobile` | Google Cloud → API key → Android restriction |
| Closed testers can't install | Not on tester list | Add emails to closed track |

### Recovery
1. Play Console → **Release dashboard** → halt rollout if critical bug.
2. Upload fixed APK/AAB; roll forward.

---

## 11. Google Cloud Maps

### Purpose
Maps on mobile (and optional web geocoding).

### Dashboard
**Google Cloud Console → APIs & Services**

### URL
`https://console.cloud.google.com/google/maps-apis/`

### Steps

1. Create or select project (e.g. `haulbrokr-prod`).
2. **Enable APIs:**
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps JavaScript API (for web `VITE_GOOGLE_MAPS_API_KEY` if used)
3. **Credentials → Create credentials → API key**.
4. Restrict key:
   - **Android apps:** package `com.haulbrokr.mobile` + SHA-1 from EAS/Play signing cert
   - **iOS apps:** bundle ID `com.haulbrokr.mobile`
   - **HTTP referrers (web):** `https://haulbrokr.com/*`
5. Copy key to:
   - EAS secret `GOOGLE_MAPS_API_KEY`
   - Optional: Render `GOOGLE_MAPS_API_KEY` (server geocoding)
   - Optional: Vercel `VITE_GOOGLE_MAPS_API_KEY`

### Smoke test

Open mobile app → driver job → map/navigation screen loads without "API key invalid".

```bash
curl -s "https://maps.googleapis.com/maps/api/js?key=AIza..." | head -c 300
```

**Expected output:** JavaScript payload without `InvalidKeyMapError` or `ApiNotActivatedMapError`.

### Common failures

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `InvalidKeyMapError` | Wrong key or API not enabled | Enable Maps SDKs; verify key |
| `RefererNotAllowedMapError` (web) | Missing referrer restriction | Add `haulbrokr.com` to HTTP referrers |
| Android map blank | SHA-1 mismatch | Add correct signing cert SHA-1 from EAS credentials |

### Recovery
1. Create new restricted key.
2. Update EAS/Vercel/Render secrets.
3. Rebuild mobile / redeploy web.

---

## Final operator certification checklist

Run after all sections above:

```bash
# Infrastructure (no secrets needed)
node scripts/staging-e2e-verify.mjs
WEB_URL=https://haulbrokr.com API_DIRECT=https://haulbrokr-api.onrender.com ./scripts/verify-production.sh

# With production .env filled (secrets required)
VERIFY_LIVE_THIRD_PARTY=1 node scripts/verify-deployment-readiness.mjs
```

Then manually complete:
- [ ] `STAGING_CHECKLIST.md` (test mode)
- [ ] `POST_LAUNCH_CHECKLIST.md` (production)
- [ ] `MONITORING_CHECKLIST.md` (alerts)
- [ ] `GO_LIVE_CHECKLIST.md` (final gate)

Record pass/fail with user IDs, job IDs, and Stripe webhook event IDs for audit.

---

## Support references

| Document | Purpose |
|----------|---------|
| `ENVIRONMENT_INVENTORY.md` | All env vars by service |
| `DEPLOYMENT_CHECKLIST.md` | Empty-account setup order |
| `docs/DEPLOY-VERCEL-RENDER.md` | Architecture + troubleshooting |
| `STRIPE_REFUND_CERTIFICATION.md` | Refund operator steps |
| `KNOWN_ISSUES.md` | Accepted limitations |
| `ROLLBACK_CHECKLIST.md` | Incident rollback |
