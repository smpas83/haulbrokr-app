#!/usr/bin/env bash
# Operator-run live production verification for carrier onboarding.
# Requires real credentials in the shell environment — never commit secrets.
#
# Required env (values never printed):
#   STAFF_USERNAME / STAFF_PASSWORD   — admin staff login
#   DATABASE_URL                     — Neon Postgres (for optional SQL checks)
#   R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET
#   PRIVATE_OBJECT_DIR               — e.g. /haulbrokr/private
#
# Optional:
#   WEB_URL=https://haulbrokr.com
#   CARRIER_EMAIL / CARRIER_PASSWORD — if you already created the test carrier
#
# Usage:
#   export STAFF_USERNAME=... STAFF_PASSWORD=...
#   ./scripts/verify-live-carrier-onboarding.sh
#
set -euo pipefail

WEB_URL="${WEB_URL:-https://haulbrokr.com}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

redact() { sed -E 's/(Bearer |password=|secret=|key=)[^[:space:]&"]+/\1***REDACTED***/gi'; }

need() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "MISSING_ENV: $name (set it in your shell; do not paste into chat)" >&2
    exit 2
  fi
}

echo "==> Env presence check (names only)"
for v in STAFF_USERNAME STAFF_PASSWORD; do
  if [ -n "${!v:-}" ]; then echo "  $v=SET"; else echo "  $v=UNSET"; fi
done
for v in DATABASE_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET PRIVATE_OBJECT_DIR; do
  if [ -n "${!v:-}" ]; then echo "  $v=SET"; else echo "  $v=UNSET (optional for API-only path)"; fi
done

need STAFF_USERNAME
need STAFF_PASSWORD

echo ""
echo "==> 1) Staff login"
LOGIN_CODE="$(curl -sS -o /tmp/hb_staff_login.json -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$WEB_URL/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${STAFF_USERNAME}\",\"password\":\"${STAFF_PASSWORD}\"}")"
echo "  HTTP $LOGIN_CODE"
[ "$LOGIN_CODE" = "200" ] || { echo "FAIL: staff login"; cat /tmp/hb_staff_login.json | redact; exit 1; }

echo ""
echo "==> 2) Staff-protected onboarding-trace"
TRACE_CODE="$(curl -sS -o /tmp/hb_onboarding_trace.json -w '%{http_code}' \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  "$WEB_URL/api/admin/onboarding-trace")"
echo "  HTTP $TRACE_CODE"
[ "$TRACE_CODE" = "200" ] || { echo "FAIL: onboarding-trace"; cat /tmp/hb_onboarding_trace.json | redact; exit 1; }

echo ""
echo "==> 3) Carrier table (from onboarding-trace)"
python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("/tmp/hb_onboarding_trace.json").read_text())
carriers = data.get("carriers") or []
print(f"carrierCount={data.get('carrierCount')} generatedAt={data.get('generatedAt')}")
print("| company | created | last activity | profile | equipment | W-9 | COI | insurance | storage | DB | admin view | % | blocker | follow-up |")
print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
for c in carriers:
    pct = c.get("completionPercent", round(100 * c.get("stepsComplete", 0) / max(c.get("stepsTotal", 1), 1)))
    print(
        f"| {c.get('carrier')} | {c.get('created','')[:10]} | {c.get('lastActivity','')[:10]} "
        f"| {c.get('profileComplete')} | {c.get('truckAdded')} | {c.get('w9Uploaded')} | {c.get('coiUploaded')} "
        f"| {c.get('insuranceUploaded')} | {c.get('storageFileExists')} | {c.get('databaseRecordExists')} "
        f"| {c.get('adminCanSeeIt')} | {pct}% | {c.get('reasonBlocked') or '—'} | {c.get('nextAction') or '—'} |"
    )
PY

echo ""
echo "==> 4) Unauthenticated gate (must be 401)"
UNAUTH="$(curl -sS -o /dev/null -w '%{http_code}' "$WEB_URL/api/admin/onboarding-trace")"
echo "  HTTP $UNAUTH"
[ "$UNAUTH" = "401" ] || { echo "FAIL: expected 401 without staff session"; exit 1; }

echo ""
echo "==> MANUAL STEPS STILL REQUIRED (browser)"
echo "  A. Create a new carrier via public signup at $WEB_URL"
echo "  B. Verify email + sign in"
echo "  C. Complete company/profile"
echo "  D. Add one truck/equipment"
echo "  E. Upload W-9 PDF, COI PDF, and one image (if supported)"
echo "  F. Confirm R2 object + Neon driver_documents + form status pending"
echo "  G. Open $WEB_URL/admin → Onboarding tab (staff)"
echo "  H. Confirm Pending Review / All Documents / View (no Unauthorized)"
echo "  I. Approve documents"
echo "  J. Confirm pending↓ verified↑ and carrier sees approved"
echo ""
echo "Re-run this script after steps A–J to refresh the carrier table."
echo "PASS only when a real document traversed carrier upload → R2 → Neon → admin View → approve."
