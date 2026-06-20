#!/usr/bin/env bash
# Post-deploy verification for Vercel + Render + Neon stack
set -euo pipefail

WEB_URL="${WEB_URL:-https://haulbrokr.com}"
API_DIRECT="${API_DIRECT:-https://haulbrokr-api.onrender.com}"

echo "==> Checking API direct (Render): $API_DIRECT/api/healthz"
curl -sf "$API_DIRECT/api/healthz" | head -c 200
echo ""

echo "==> Checking API via Vercel proxy: $WEB_URL/api/healthz"
curl -sf "$WEB_URL/api/healthz" | head -c 200
echo ""

echo "==> Checking web homepage: $WEB_URL"
curl -sf -o /dev/null -w "HTTP %{http_code}\n" "$WEB_URL"

echo ""
echo "All checks passed if you see {\"status\":\"ok\"} above and HTTP 200 for homepage."
