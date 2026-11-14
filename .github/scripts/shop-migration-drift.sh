#!/bin/sh
set -eu

cd "$(dirname -- "$0")/../../apps/auto-service-shop"

pnpm exec medusa db:migrate --skip-links --skip-search --skip-scripts
pnpm exec medusa db:generate catalog supplier publish vin_lookup demand

drift=$(git status --porcelain -- 'src/modules/*/migrations/*')
if [ -n "$drift" ]; then
  echo "$drift" >&2
  echo "The shop models drifted from their migrations: run medusa db:generate <module> and commit the new additive migration and snapshot (docs/guides/shop-migrations.md)" >&2
  exit 1
fi
