#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <dir holding migrations.sha256> <migration glob>..." >&2
  exit 2
fi
cd "$1"
shift

if command -v sha256sum >/dev/null; then
  sum=sha256sum
else
  sum='shasum -a 256'
fi

failed=0
if ! $sum -c --quiet migrations.sha256 >&2; then
  echo "A migration listed in $PWD/migrations.sha256 changed or disappeared. A database may already have run it, so never edit it: add a new additive migration instead." >&2
  failed=1
fi

if [ -n "${FROZEN_BASE:-}" ] && base=$(git show "$FROZEN_BASE:./migrations.sha256" 2>/dev/null); then
  rewritten=$(printf '%s\n' "$base" | grep -vxF -f migrations.sha256 || true)
  if [ -n "$rewritten" ]; then
    printf '%s\n' "$rewritten" >&2
    echo "These lines of $PWD/migrations.sha256 at $FROZEN_BASE were rewritten or removed. A database may already have run those migrations: restore them and add a new additive migration instead." >&2
    failed=1
  fi
fi

for pattern in "$@"; do
  for file in $pattern; do
    [ -e "$file" ] || continue
    if ! cut -d ' ' -f 3- migrations.sha256 | grep -qxF "$file"; then
      echo "$file is not in migrations.sha256. Append it: $sum $file >>migrations.sha256" >&2
      failed=1
    fi
  done
done

exit "$failed"
