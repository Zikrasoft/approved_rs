#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/shop-ci-env.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
check() {
  if [ "$1" = "$2" ]; then
    echo "ok - $3"
  else
    echo "not ok - $3"
    failures=$((failures + 1))
  fi
}

cat >"$work/template" <<'TEMPLATE'
NODE_ENV=production

NEW_REQUIRED_SECRET=
# a note for the owner
TYPESENSE_API_KEY=
FILE_URL=
STORE_CORS=https://carlab.rs
TEMPLATE
sh "$script" "$work/template" >"$work/env"
value() { sed -n "s/^$1=//p" "$work/env"; }

check "$(value NODE_ENV)" production 'a value the template sets is kept'
check "$(value STORE_CORS)" https://carlab.rs 'a URL the template sets is kept'
check "$(value NEW_REQUIRED_SECRET)" ci-placeholder-of-thirty-two-characters 'an empty value gets a placeholder long enough for a production secret'
check "$(value TYPESENSE_API_KEY)" xyz 'the test stack replaces what it serves'
check "$(value FILE_URL)" https://carlab-public.s3.eu-central-1.amazonaws.com 'a URL-shaped value gets a URL'
check "$(value DATABASE_URL)" postgres://postgres:postgres@127.0.0.1:55432/medusa 'what compose adds is added'
check "$(grep -c '^S3_ENDPOINT=$' "$work/env")" 1 'an optional URL stays empty'
check "$(grep -vc '^[A-Z_0-9]*=' "$work/env" || true)" 0 'only assignments are written'
check "$(cut -d= -f1 "$work/env" | sort | uniq -d)" '' 'each name is written once'

[ "$failures" -eq 0 ]
