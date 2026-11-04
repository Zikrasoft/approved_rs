#!/bin/sh
set -eu

url=$(sed -n 's/^MEDUSA_BACKEND_URL=//p' "${1:-.vercel/.env.production.local}" | tail -n 1 | tr -d '"')
[ -n "$url" ] || exit 0
curl -fsS -o /dev/null --max-time 10 --retry 3 --retry-delay 5 --retry-all-errors "${url%/}/health" || exit 1
