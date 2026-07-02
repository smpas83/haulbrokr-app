#!/bin/sh
# Reset local mobile dev: discard debug edits, checkout auth fix branch, clean .env
set -e

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MOBILE="$ROOT/artifacts/haulbrokr-mobile"

cd "$ROOT"

echo "→ Stashing local mobile edits (if any)..."
git stash push -u -m "mobile-local-$(date +%s)" -- \
  artifacts/haulbrokr-mobile/app/(tabs)/account.tsx \
  artifacts/haulbrokr-mobile/app/_layout.tsx \
  artifacts/haulbrokr-mobile/app/sign-in.tsx \
  2>/dev/null || true

echo "→ Checking out auth fix branch..."
git fetch origin cursor/fix-signout-auth-spinning-4434
git checkout cursor/fix-signout-auth-spinning-4434
git pull --ff-only origin cursor/fix-signout-auth-spinning-4434

# Preserve existing Clerk key from .env when present; otherwise leave placeholder.
CLERK_KEY=""
if [ -f "$MOBILE/.env" ]; then
  CLERK_KEY="$(grep '^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=' "$MOBILE/.env" | tail -1 | cut -d= -f2-)"
fi
if [ -z "$CLERK_KEY" ] || [ "$CLERK_KEY" = "pk_test_xxx" ] || [ "$CLERK_KEY" = "pk_test_YOUR_REAL_KEY" ]; then
  echo "⚠️  Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in $MOBILE/.env manually after this script runs."
  CLERK_KEY="pk_test_REPLACE_ME"
fi

echo "→ Writing clean .env..."
cat > "$MOBILE/.env" <<EOF
EXPO_PUBLIC_DOMAIN=haulbrokr.com
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_KEY
GOOGLE_MAPS_API_KEY=
EOF

echo "→ Killing stale Metro..."
lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:8082 2>/dev/null | xargs kill -9 2>/dev/null || true

echo "✅ Done. Start the app with:"
echo "   cd $MOBILE && npx expo start --clear --ios"
