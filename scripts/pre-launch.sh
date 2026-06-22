#!/usr/bin/env bash
# Run full pre-launch verification locally (same as CI + production builds).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Typecheck"
pnpm run typecheck

echo "==> API tests"
pnpm --filter @workspace/api-server run test

echo "==> Web tests"
pnpm --filter @workspace/haulbrokr run test

echo "==> Mobile tests"
pnpm --filter @workspace/haulbrokr-mobile run test

echo "==> API production build"
pnpm --filter @workspace/api-server run build

echo "==> Web production build"
pnpm --filter @workspace/haulbrokr run build

echo ""
echo "All pre-launch checks passed."
echo "Next: push schema + seed staff on Neon, deploy Render + Vercel, run scripts/verify-production.sh"
