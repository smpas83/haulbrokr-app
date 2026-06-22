#!/usr/bin/env bash
# Push HaulBrokr schema to Neon and seed staff admin accounts.
# Usage:
#   export DATABASE_URL='<paste full Neon pooled URL from dashboard>'
#   bash scripts/setup-neon.sh
# Or paste URL when prompted (not saved unless you add it to .env yourself).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Paste your Neon **pooled** connection string (ends with ?sslmode=require):"
  read -r DATABASE_URL
  export DATABASE_URL
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if echo "$DATABASE_URL" | grep -q '\.\.\.'; then
  echo "ERROR: DATABASE_URL contains '...' — that is a doc placeholder, not a real URL." >&2
  echo "Copy the full string from Neon → Connect → Pooled connection." >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -qE '^postgres(ql)?://'; then
  echo "ERROR: DATABASE_URL must start with postgres:// or postgresql://" >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -q 'sslmode=require'; then
  echo "WARN: Neon URLs should include ?sslmode=require"
fi

if ! echo "$DATABASE_URL" | grep -q 'pooler'; then
  echo "WARN: Use the **pooled** connection string from Neon (hostname contains -pooler)"
fi

echo "==> Pushing database schema to Neon"
pnpm --filter @workspace/db run push

if [ -z "${STAFF_DEFAULT_PASSWORD:-}" ]; then
  echo ""
  echo "Enter a strong password for staff admin accounts (ceo, cto, cfo, etc.):"
  read -rs STAFF_DEFAULT_PASSWORD
  echo ""
  export STAFF_DEFAULT_PASSWORD
fi

if [ -z "$STAFF_DEFAULT_PASSWORD" ]; then
  echo "STAFF_DEFAULT_PASSWORD is required for production seed." >&2
  exit 1
fi

echo "==> Seeding staff admin users"
NODE_ENV=production pnpm --filter @workspace/api-server run seed-staff

echo ""
echo "Done. Database is ready for Render deploy."
echo "Staff login: https://haulbrokr.com/admin/login (after Vercel is live)"
echo "Users: ceo, president, cto, cfo, accounting, it, programmer"
