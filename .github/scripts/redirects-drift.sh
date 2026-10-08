#!/bin/sh
set -eu

for script in apps/*/scripts/redirects.ts; do
  node --experimental-strip-types "$script"
done

if ! git diff --exit-code -- 'apps/*/vercel.json'; then
  echo "vercel.json redirects drifted from src/redirects.ts — run the app's scripts/redirects.ts and commit the result" >&2
  exit 1
fi
