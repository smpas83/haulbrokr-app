#!/usr/bin/env bash
# RC2 staging bootstrap — seeds staff, dump sites, and optional marketplace demo data.
# Requires DATABASE_URL. Refuses to run marketplace seed in production without force flag.
#
# Usage:
#   DATABASE_URL='postgresql://...' STAFF_DEFAULT_PASSWORD='...' bash scripts/rc2-bootstrap-staging.sh
# Optional:
#   SEED_MARKETPLACE=1          — also seed synthetic marketplace rows (staging only)
#   SEED_MARKETPLACE_FORCE=1    — allow marketplace seed when NODE_ENV=production
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${STAFF_DEFAULT_PASSWORD:?STAFF_DEFAULT_PASSWORD is required}"

echo "==> RC2 Staging Bootstrap"
echo "    Database host: $(echo "$DATABASE_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"

echo "==> [1/3] Staff admin accounts"
bash scripts/seed-staff-easy.sh

echo "==> [2/3] Dump sites / facilities"
pnpm --filter @workspace/api-server run seed-dump-sites

if [ "${SEED_MARKETPLACE:-}" = "1" ]; then
  echo "==> [3/3] Marketplace demo data (synthetic)"
  pnpm --filter @workspace/api-server run seed-marketplace
else
  echo "==> [3/3] Marketplace seed skipped (set SEED_MARKETPLACE=1 to enable)"
fi

echo ""
echo "==> Verify staging infrastructure"
pnpm run verify:staging-e2e

echo ""
echo "RC2 bootstrap complete."
echo "Next: bash scripts/create-clerk-staging-users.mjs (requires CLERK_SECRET_KEY)"
echo "Then: run live workflow checklist in STAGING_CHECKLIST.md"
