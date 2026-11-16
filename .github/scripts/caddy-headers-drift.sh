#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."

node --experimental-strip-types infra/auto-service-shop/caddy-headers.ts

if ! git diff --exit-code -- infra/auto-service-shop/caddy/security-headers.caddy; then
  echo "caddy/security-headers.caddy drifted from site-kit's SECURITY_HEADERS: run node --experimental-strip-types infra/auto-service-shop/caddy-headers.ts and commit the result" >&2
  exit 1
fi
