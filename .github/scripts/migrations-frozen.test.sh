#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/migrations-frozen.sh"
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
  sh "$script" "$work/shop" 'src/modules/*/migrations/*.ts' 'src/migration-scripts/*.ts' >/dev/null 2>"$work/stderr" || status=$?
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

committed() {
  stage
  (cd "$work/shop" && git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm base)
}
based() {
  status=0
  (cd "$work/shop" && FROZEN_BASE=HEAD sh "$script" . 'src/modules/*/migrations/*.ts' 'src/migration-scripts/*.ts') >/dev/null 2>"$work/stderr" || status=$?
}

committed
echo two >"$work/shop/src/modules/catalog/migrations/Migration1.ts"
(cd "$work/shop" && digest src/modules/catalog/migrations/Migration1.ts src/migration-scripts/order.ts >migrations.sha256)
based
check "$status" 1 'a migration edited together with its hash fails against the base'
check "$(grep -c 'restore them' "$work/stderr")" 1 'a rewritten hash says why'

committed
echo new >"$work/shop/src/modules/catalog/migrations/Migration2.ts"
(cd "$work/shop" && digest src/modules/catalog/migrations/Migration2.ts >>migrations.sha256)
based
check "$status" 0 'a migration appended after the base passes'

stage
status=0
sh "$script" "$work/shop" >/dev/null 2>"$work/stderr" || status=$?
check "$status" 2 'a call without a migration glob is refused'

[ "$failures" -eq 0 ]
