#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
check() {
  if [ "$2" = "$3" ]; then echo "ok - $1"; else echo "not ok - $1"; failures=$((failures + 1)); fi
}
differ() {
  if [ "$2" != "$3" ]; then echo "ok - $1"; else echo "not ok - $1"; failures=$((failures + 1)); fi
}

tree() {
  rm -rf "$work/t"
  mkdir -p "$work/t/caddy" "$work/t/caddy-image"
  cp "$here/caddy-tag.sh" "$work/t/"
  printf 'FROM caddy\n' >"$work/t/caddy-image/Dockerfile"
  printf ':80\n' >"$work/t/caddy/Caddyfile"
  printf 'header x\n' >"$work/t/caddy/security-headers.caddy"
}
tag() { sh "$work/t/caddy-tag.sh"; }

tree
base=$(tag)
check 'the tag is 40 hex characters' "$(printf '%s' "$base" | grep -cE '^[0-9a-f]{40}$')" 1
check 'the tag is deterministic' "$(tag)" "$base"
printf 'FROM other\n' >"$work/t/caddy-image/Dockerfile"
differ 'a changed Dockerfile changes the tag' "$(tag)" "$base"
tree
printf ':81\n' >"$work/t/caddy/Caddyfile"
differ 'a changed Caddyfile changes the tag' "$(tag)" "$base"
tree
printf 'header y\n' >"$work/t/caddy/security-headers.caddy"
differ 'changed security headers change the tag' "$(tag)" "$base"
tree
printf 'x' >"$work/t/unrelated"
check 'an unrelated file does not change the tag' "$(tag)" "$base"
check 'the tag does not depend on the checkout path' "$(cd "$work/t" && sh ./caddy-tag.sh)" "$base"

exit "$failures"
