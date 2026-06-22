#!/usr/bin/env bash
# Post-deploy verification for Vercel + Render + Neon stack
set -euo pipefail

WEB_URL="${WEB_URL:-https://haulbrokr.com}"
API_DIRECT="${API_DIRECT:-https://haulbrokr-api.onrender.com}"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "OK: $1"; }

echo "==> HaulBrokr production smoke checks"
echo "    Web:  $WEB_URL"
echo "    API:  $API_DIRECT"
echo ""

echo "==> API health (Render direct)"
HEALTH_DIRECT="$(curl -sf "$API_DIRECT/api/healthz" || fail "API direct health check failed")"
echo "$HEALTH_DIRECT" | head -c 200
echo ""
echo "$HEALTH_DIRECT" | grep -q '"status":"ok"' || fail "API direct health status not ok"
ok "Render /api/healthz"

echo "==> API health (Vercel proxy)"
HEALTH_PROXY="$(curl -sf "$WEB_URL/api/healthz" || fail "Vercel API proxy failed")"
echo "$HEALTH_PROXY" | head -c 200
echo ""
echo "$HEALTH_PROXY" | grep -q '"status":"ok"' || fail "Proxied health status not ok"
ok "Vercel /api/healthz proxy"

echo "==> Web homepage"
HOME_CODE="$(curl -sf -o /dev/null -w "%{http_code}" "$WEB_URL")"
[ "$HOME_CODE" = "200" ] || fail "Homepage returned HTTP $HOME_CODE"
ok "Homepage HTTP 200"

echo "==> Admin login page (SPA shell)"
ADMIN_LOGIN_CODE="$(curl -sf -o /dev/null -w "%{http_code}" "$WEB_URL/admin/login")"
[ "$ADMIN_LOGIN_CODE" = "200" ] || fail "/admin/login returned HTTP $ADMIN_LOGIN_CODE"
ok "/admin/login HTTP 200"

echo "==> Admin access endpoint (unauthenticated → not staff)"
ACCESS="$(curl -sf "$WEB_URL/api/admin/access" || fail "/api/admin/access unreachable")"
echo "$ACCESS" | head -c 200
echo ""
echo "$ACCESS" | grep -q '"isAdmin":false' || fail "Expected isAdmin:false for anonymous access"
ok "/api/admin/access anonymous gate"

echo ""
echo "All automated checks passed."
echo "Manual: sign in at $WEB_URL/admin/login (staff) or Clerk; run marketplace smoke test."
