#!/bin/sh
set -eu

cd "$(dirname -- "$0")/../../apps/carlab-shop"

pnpm exec medusa db:migrate --skip-links --skip-search --skip-scripts
pnpm exec medusa db:generate catalog supplier publish vin_lookup

drift=$(git status --porcelain -- 'src/modules/*/migrations/*')
if [ -n "$drift" ]; then
  echo "$drift" >&2
  echo "The shop models drifted from their migrations: run medusa db:generate <module> and commit the new additive migration and snapshot (AGENTS.md, Shop migrations)" >&2
  exit 1
fi
