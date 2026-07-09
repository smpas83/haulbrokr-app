#!/usr/bin/env bash
# Ship HaulBrokr iOS production build to TestFlight via EAS.
# Requires: Expo login (eas login) OR EXPO_TOKEN env var.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/artifacts/haulbrokr-mobile"

cd "$MOBILE"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  if ! pnpm exec eas whoami >/dev/null 2>&1; then
    echo "Not logged into Expo."
    echo "Run:  pnpm exec eas login"
    echo "Or set: EXPO_TOKEN=... (https://expo.dev/accounts/[account]/settings/access-tokens)"
    exit 1
  fi
  echo "Logged into Expo as: $(pnpm exec eas whoami)"
else
  echo "Using EXPO_TOKEN for non-interactive EAS auth."
fi

echo "→ Building iOS production…"
pnpm exec eas build --platform ios --profile production --non-interactive

echo "→ Submitting latest iOS build to TestFlight…"
pnpm exec eas submit --platform ios --profile production --latest --non-interactive

echo
echo "Done. After TestFlight processing:"
echo "  1. Install on a physical iPhone"
echo "  2. Follow docs/APP_REVIEW_RESUBMIT.md device test script"
echo "  3. Attach screen recording + paste Review Notes in App Store Connect"
echo "  4. Resubmit for review"
