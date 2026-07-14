# FMCSA Production Operator Checklist

HaulBrokr supports two FMCSA verification providers:

1. **Live QCMobile** (`LiveQcMobileFmcsaProvider`) — when `FMCSA_WEB_KEY` is set
2. **Manual review** (`ManualReviewFmcsaProvider`) — safe fallback (staff verify in admin)

Live access cannot be fabricated in CI. Until the credential is configured against real QCMobile, treat live FMCSA as an **EXTERNAL BLOCKER**. Staff-manual verification remains the production-safe path.

## Obtain the credential

1. Register for FMCSA QCMobile / Web Services access through the FMCSA developer portal.
2. Request a `webKey` scoped to carrier lookup (`/qc/services/carriers/{dotNumber}`).
3. Confirm the key works against the public QCMobile base URL:
   - Default: `https://mobile.fmcsa.dot.gov/qc/services`
4. Store the key only in the host secret store (Render / Vercel env) — never in git, mobile builds, or client bundles.

## Configure production / staging

| Variable | Required | Notes |
|---|---|---|
| `FMCSA_WEB_KEY` | for live | QCMobile webKey |
| `FMCSA_API_BASE_URL` | optional | Override base URL (default QCMobile) |

On API boot, missing `FMCSA_WEB_KEY` does **not** block startup. Check informational status:

```bash
curl -s "$API_URL/api/readyz/details" | jq .fmcsa
```

Expected shapes:

- `liveConfigured: true`, `health: configured_healthy` — live path ready
- `liveConfigured: true`, `health: configured_unavailable` — key present but provider down
- `liveConfigured: false`, `health: missing_credentials` — manual fallback active

## Verification rules (enforced in code)

- Bounded timeout (8s) and retries (2)
- Response caching (15 minutes) by DOT number
- Structured codes: `ok`, `carrier_not_found`, `provider_incomplete`, `provider_unavailable`, `missing_credentials`, `invalid_input`
- **Never auto-verify** on a partial response
- Store `fmcsa_source`, `compliance_checked_at`, and returned fields on `dot_cdl_compliance`
- Incomplete authority / insurance / safety / identity → status stays `pending` for staff review

## Staff-manual fallback

`PATCH /api/account/compliance/verify` (compliance permission) remains available and sets `fmcsa_source = manual_review`.

## Contract tests

Unit tests in `artifacts/api-server/src/lib/fmcsa/fmcsa.test.ts` exercise fixtures matching the QCMobile carrier schema without calling the live network.
