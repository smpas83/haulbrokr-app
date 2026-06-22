#!/bin/sh
# Mobile dev launcher.
#
# On Replit, the Replit-provided variables below are present and get applied as
# overrides (proxy URL, API domain, repl id, Clerk key, Metro hostname) so the
# behavior matches the Replit dev environment.
#
# Off Replit (e.g. Cursor / a plain local machine) those variables are absent, so
# none of the overrides are applied and Expo falls back to the values from a local
# `.env` file (EXPO_PUBLIC_DOMAIN, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY), which Expo
# loads automatically. See `.env.example`.
set -e

export CI=1
export EXPO_NO_TELEMETRY=1

if [ -n "$REPLIT_EXPO_DEV_DOMAIN" ]; then
  export EXPO_PACKAGER_PROXY_URL="https://$REPLIT_EXPO_DEV_DOMAIN"
fi
if [ -n "$REPLIT_DEV_DOMAIN" ]; then
  export EXPO_PUBLIC_DOMAIN="$REPLIT_DEV_DOMAIN"
  export REACT_NATIVE_PACKAGER_HOSTNAME="$REPLIT_DEV_DOMAIN"
fi
if [ -n "$REPL_ID" ]; then
  export EXPO_PUBLIC_REPL_ID="$REPL_ID"
fi
if [ -n "$CLERK_PUBLISHABLE_KEY" ]; then
  export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"
fi

if [ -n "$PORT" ]; then
  exec pnpm exec expo start --localhost --port "$PORT" --non-interactive
else
  exec pnpm exec expo start --localhost --non-interactive
fi
