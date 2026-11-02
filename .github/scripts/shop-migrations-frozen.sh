#!/bin/sh
set -eu

cd "${1:-$(dirname -- "$0")/../../apps/auto-service-shop}"

if command -v sha256sum >/dev/null; then
  sum=sha256sum
else
  sum='shasum -a 256'
fi

failed=0
if ! $sum -c --quiet migrations.sha256 >&2; then
  echo "A shop migration listed in migrations.sha256 changed or disappeared. A database may already have run it, so never edit it: add a new additive migration instead (AGENTS.md, Shop migrations)." >&2
  failed=1
fi

for file in src/modules/*/migrations/*.ts src/migration-scripts/*.ts; do
  [ -e "$file" ] || continue
  if ! cut -d ' ' -f 3- migrations.sha256 | grep -qxF "$file"; then
    echo "$file is not in migrations.sha256. Append it: $sum $file >>migrations.sha256" >&2
    failed=1
  fi
done

exit "$failed"
