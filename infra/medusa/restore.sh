#!/bin/sh
set -eu
cd "$(dirname -- "$0")"

dump=${1:-}
files=${2:-}
[ -s "$dump" ] || {
  echo "usage: $0 /var/backups/carlab/db-<stamp>.dump [/var/backups/carlab/static-<stamp>.tar.gz]" >&2
  exit 2
}
[ -z "$files" ] || [ -s "$files" ] || {
  echo "$files is missing or empty." >&2
  exit 2
}

docker compose up -d --wait postgres

tables=$(docker compose exec -T postgres psql -U carlab -d carlab -tAc \
  "select count(*) from pg_tables where schemaname = 'public'" | tr -d '[:space:]')
if [ "$tables" != 0 ] && [ "${RESTORE_OVER_EXISTING:-}" != yes ]; then
  echo "carlab already has $tables table(s). Set RESTORE_OVER_EXISTING=yes to replace them." >&2
  exit 1
fi

docker compose stop medusa

echo "==> Database from $dump"
docker compose exec -T postgres \
  pg_restore -U carlab -d carlab --clean --if-exists --no-owner --single-transaction <"$dump"

if [ -n "$files" ]; then
  echo "==> Files from $files"
  docker compose run --rm -T --no-deps --entrypoint sh medusa \
    -c 'find /server/static -mindepth 1 -delete && tar -C /server/static -xzf -' <"$files"
fi

docker compose up -d --wait --wait-timeout 300
echo "Restored."
