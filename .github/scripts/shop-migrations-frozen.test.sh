#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/shop-migrations-frozen.sh"
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
digest() {
  if command -v sha256sum >/dev/null; then
    sha256sum "$@"
  else
    shasum -a 256 "$@"
  fi
}
stage() {
  rm -rf "$work/shop"
  mkdir -p "$work/shop/src/modules/catalog/migrations" "$work/shop/src/migration-scripts"
  echo one >"$work/shop/src/modules/catalog/migrations/Migration1.ts"
  echo script >"$work/shop/src/migration-scripts/order.ts"
  (cd "$work/shop" && digest src/modules/catalog/migrations/Migration1.ts src/migration-scripts/order.ts >migrations.sha256)
}
verdict() {
  status=0
  sh "$script" "$work/shop" >/dev/null 2>"$work/stderr" || status=$?
}

stage
verdict
check "$status" 0 'unchanged migrations pass'

stage
echo two >"$work/shop/src/modules/catalog/migrations/Migration1.ts"
verdict
check "$status" 1 'an edited migration fails'
check "$(grep -c 'never edit it' "$work/stderr")" 1 'an edited migration says why'

stage
rm "$work/shop/src/migration-scripts/order.ts"
verdict
check "$status" 1 'a deleted migration script fails'

stage
echo new >"$work/shop/src/modules/catalog/migrations/Migration2.ts"
verdict
check "$status" 1 'a migration missing from the manifest fails'
check "$(grep -c 'Migration2.ts >>migrations.sha256' "$work/stderr")" 1 'a missing migration says how to append it'

stage
echo new >"$work/shop/src/modules/catalog/migrations/Migration2.ts"
(cd "$work/shop" && digest src/modules/catalog/migrations/Migration2.ts >>migrations.sha256)
verdict
check "$status" 0 'an appended new migration passes'

[ "$failures" -eq 0 ]
