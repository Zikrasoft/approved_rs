#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."

file=infra/auto-service-shop/caddy/security-headers.caddy
node --experimental-strip-types --input-type=module \
  -e "import { caddySecurityHeaders } from './packages/site-kit/src/securityHeaders.ts'; process.stdout.write(caddySecurityHeaders());" >"$file"

if ! git diff --exit-code -- "$file" || [ -n "$(git ls-files --others --exclude-standard -- "$file")" ]; then
  echo "$file drifted from site-kit's SECURITY_HEADERS: run .github/scripts/security-headers-drift.sh and commit the file" >&2
  exit 1
fi
