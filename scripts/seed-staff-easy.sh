#!/usr/bin/env bash
# Seed HaulBrokr staff admin accounts against Neon/Postgres.
# Prompts for DATABASE_URL and STAFF_DEFAULT_PASSWORD when not set.
#
# Usage:
#   bash scripts/seed-staff-easy.sh
# Or non-interactive:
#   DATABASE_URL='postgresql://...' STAFF_DEFAULT_PASSWORD='...' bash scripts/seed-staff-easy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Paste your Neon **pooled** connection string (with ?sslmode=require):"
  read -r DATABASE_URL
  export DATABASE_URL
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -qE '^postgres(ql)?://'; then
  echo "ERROR: DATABASE_URL must start with postgres:// or postgresql://" >&2
  exit 1
fi

if [ -z "${STAFF_DEFAULT_PASSWORD:-}" ]; then
  echo ""
  echo "Enter the staff admin password (used for ceo, cto, cfo, it, etc.):"
  read -rs STAFF_DEFAULT_PASSWORD
  echo ""
  export STAFF_DEFAULT_PASSWORD
fi

if [ -z "$STAFF_DEFAULT_PASSWORD" ]; then
  echo "STAFF_DEFAULT_PASSWORD is required." >&2
  exit 1
fi

echo "==> Pushing schema (idempotent)"
pnpm --filter @workspace/db run push

echo "==> Seeding staff users"
NODE_ENV=production pnpm --filter @workspace/api-server run seed-staff

echo ""
echo "Staff accounts ready."
echo "Login: https://haulbrokr.com/admin/login"
echo "Users: ceo, president, cto, cfo, accounting, it, programmer"
echo "Password: (value of STAFF_DEFAULT_PASSWORD)"
