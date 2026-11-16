#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."

for script in apps/*/scripts/redirects.ts; do
  node --experimental-strip-types "$script"
done

if ! git diff --exit-code -- 'apps/*/vercel.json' infra/auto-service-shop/caddy/sites ||
  [ -n "$(git ls-files --others --exclude-standard -- infra/auto-service-shop/caddy/sites)" ]; then
  echo "vercel.json or a Caddy site config drifted from its source (the redirect rules, site-kit's SECURITY_HEADERS): run the app's scripts/redirects.ts and commit vercel.json and infra/auto-service-shop/caddy/sites/<app>.caddy" >&2
  exit 1
fi
