# HaulBrokr Environment Inventory

Use this as the source of truth for staging and production configuration. Do not commit filled `.env` files or secret values.

## API / Render

| Variable | Required | Owner | Comes from | Example format | Description |
|---|---:|---|---|---|---|
| `NODE_ENV` | Yes | Render/API | Render env | `production` | Enables production startup validation. |
| `PORT` | Yes | Render/API | Render env | `8080` | HTTP port for the Express API. |
| `DATABASE_URL` | Yes | Neon/Supabase/API | Neon pooled connection string | `postgresql://user:pass@ep-name-pooler.region.aws.neon.tech/db?sslmode=require` | Postgres connection used by Drizzle and `/api/readyz`. |
| `CLERK_SECRET_KEY` | Yes | Clerk/API | Clerk dashboard | `sk_test_...` / `sk_live_...` | Backend Clerk secret for auth verification and proxy calls. |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk/API | Clerk dashboard | `pk_test_...` / `pk_live_...` | Backend publishable key used with Clerk middleware. |
| `STRIPE_SECRET_KEY` | Yes | Stripe/API | Stripe dashboard | `sk_test_...` / `sk_live_...` | Stripe API key for charges, Checkout, Connect, and payouts. |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe/API | Stripe dashboard | `pk_test_...` / `pk_live_...` | Publishable key returned to clients where needed. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe/API | Stripe webhook endpoint | `whsec_...` | Signature secret for `/api/webhooks/stripe`. |
| `PAYMENTS_MOCK_MODE` | Optional | API | Local dev only | unset / `false` | Must be unset or false in staging and production. |
| `RESEND_API_KEY` | Yes | Resend/API | Resend dashboard | `re_...` | Transactional email API key. |
| `RESEND_FROM_EMAIL` | Yes | Resend/API | Verified Resend domain | `noreply@haulbrokr.com` | Sender used for notifications and reminders. |
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2/API | Cloudflare dashboard | `0123456789abcdef...` | Account ID for R2 S3-compatible endpoint. |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2/API | R2 API token | `...` | R2 access key ID. |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2/API | R2 API token | `...` | R2 secret access key. |
| `R2_BUCKET` | Yes | Cloudflare R2/API | R2 bucket | `haulbrokr-uploads` | Bucket for compliance docs, photos, and tickets. |
| `R2_PUBLIC_URL` | Yes | Cloudflare R2/API | R2 custom/public domain | `https://cdn.haulbrokr.com` | Public base URL for public objects. |
| `PRIVATE_OBJECT_DIR` | Yes | Cloudflare R2/API | Deployment convention | `/haulbrokr/private` | Private object prefix. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Yes | Cloudflare R2/API | Deployment convention | `/haulbrokr/public` | Comma-separated public prefixes. |
| `UPLOAD_TOKEN_SECRET` | Yes | API | Render generated secret | 32+ random chars | HMAC secret for upload tokens. |
| `TICKET_QR_SECRET` | Yes | API | Render generated secret | 32+ random chars | HMAC secret for ticket QR verification. |
| `STAFF_AUTH_SECRET` | Yes | API | Render generated secret | 32+ random chars | HMAC secret for staff session cookies. |
| `ADMIN_USER_IDS` | Yes | Clerk/API | Clerk user IDs | `user_abc,user_def` | Clerk users allowed to bootstrap admin access. |
| `STAFF_DEFAULT_PASSWORD` | Optional | API/Admin | Release operator | strong password | Used only when seeding staff users. Do not leave as a weak/default value. |
| `CORS_ALLOWED_ORIGINS` | Optional | API/Render | Release operator | `https://haulbrokr.com,https://www.haulbrokr.com` | Extra browser origins beyond built-in production origins. |
| `AUTOMATION_KEY` | Optional | API | Release operator | 32+ random chars | Enables protected `/api/automation/*` jobs. Leave unset if unused. |
| `LOG_LEVEL` | Optional | API | Render env | `info` | Pino log level. |

## Web / Vercel

| Variable | Required | Owner | Comes from | Example format | Description |
|---|---:|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk/Web | Clerk dashboard | `pk_test_...` / `pk_live_...` | Clerk key baked into the Vite build. |
| `VITE_CLERK_PROXY_URL` | Yes | Web/Vercel | Deployment URL | `/api/__clerk` | Same-origin Clerk proxy URL. |
| `BASE_PATH` | Optional | Web | Host/runtime | `/` | Local serve base path. Build falls back to `/`. |

## Mobile / Expo

| Variable | Required | Owner | Comes from | Example format | Description |
|---|---:|---|---|---|---|
| `EXPO_PUBLIC_DOMAIN` | Yes | Expo/API | Release operator | `haulbrokr.com` | Hostname used by mobile for `https://<domain>/api`. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk/Expo | Clerk dashboard | `pk_test_...` / `pk_live_...` | Clerk publishable key for Expo app auth. |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps/Expo | Google Cloud Console | `AIza...` | Maps SDK key for Android/iOS. Restrict by app package/bundle. |
| `GOOGLE_MAPS_API_KEY` | Optional | API/Render | Google Cloud Console | `AIza...` | Server-side geocoding for marketplace map (falls back to Nominatim). |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Web/Vercel | Google Cloud Console | `AIza...` | Google Maps JavaScript API for haulbrokr.com live map page. |

## Deployment automation

| Variable | Required | Owner | Comes from | Example format | Description |
|---|---:|---|---|---|---|
| `WEB_URL` | Optional | Validation | Release operator | `https://haulbrokr.com` | Web URL checked by deployment validation scripts. |
| `API_DIRECT` | Optional | Validation | Release operator | `https://haulbrokr-api.onrender.com` | Direct Render API URL checked by validation scripts. |
| `VERIFY_LIVE_THIRD_PARTY` | Optional | Validation | Release operator | `1` | Enables read-only Clerk, Stripe, Resend, Maps, and R2 public URL checks. |
| `SKIP_ENDPOINT_CHECKS` | Optional | Validation | Release operator | `1` | Skip web/API HTTP checks when validating env before deployment. |
| `VERCEL_TOKEN` | Optional | Vercel | Vercel account token | `...` | Required only for CLI/API deployment automation. |
| `VERCEL_ORG_ID` | Optional | Vercel | Vercel project settings | `team_...` | Required only for CLI/API deployment automation. |
| `VERCEL_PROJECT_ID` | Optional | Vercel | Vercel project settings | `prj_...` | Required only for CLI/API deployment automation. |
| `RENDER_API_KEY` | Optional | Render | Render account settings | `rnd_...` | Required only for Render API deployment automation. |
| `RENDER_SERVICE_ID` | Optional | Render | Render service settings | `srv-...` | Required only for Render API deployment automation. |

## Supabase note

HaulBrokr currently uses Neon/Postgres through Drizzle, not Supabase services. If Supabase is substituted later, `DATABASE_URL` must still be a Postgres URL with TLS enabled and should pass the same validation checks.
