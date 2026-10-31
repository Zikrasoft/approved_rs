#!/bin/sh
set -eu

for script in apps/*/scripts/redirects.ts; do
  node --experimental-strip-types "$script"
done

if ! git diff --exit-code -- 'apps/*/vercel.json'; then
  echo "vercel.json redirects or headers drifted from their source (the redirect rules, site-kit's SECURITY_HEADERS): run the app's scripts/redirects.ts and commit the result" >&2
  exit 1
fi
