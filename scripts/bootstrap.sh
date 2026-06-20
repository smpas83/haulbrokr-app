#!/usr/bin/env bash
# One-command local bootstrap for HaulBrokr
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> HaulBrokr bootstrap"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm required. Install: npm install -g pnpm"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in secrets before production deploy."
fi

pnpm install --frozen-lockfile

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgres://haulbrokr:haulbrokr@localhost:5432/haulbrokr?sslmode=disable"
  echo "Using default DATABASE_URL (docker compose db)"
fi

echo "==> Pushing database schema"
pnpm --filter @workspace/db run push

echo "==> Typecheck"
pnpm run typecheck

echo "==> API tests"
pnpm --filter @workspace/api-server run test

echo ""
echo "Bootstrap complete. Start services:"
echo "  docker compose up -d db          # if using local Postgres"
echo "  PORT=8080 pnpm --filter @workspace/api-server run dev"
echo "  PORT=5173 pnpm --filter @workspace/dumpbroker run dev"
echo "  PORT=8082 pnpm --filter @workspace/dumpbroker-mobile run dev"
