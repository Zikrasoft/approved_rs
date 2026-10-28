#!/bin/sh
set -eu

dump=${1:-}
[ -s "$dump" ] || {
  echo "usage: $0 /var/backups/carlab/db-<stamp>.dump" >&2
  exit 2
}

dump=$(cd "$(dirname -- "$dump")" && pwd)/$(basename -- "$dump")

cd "$(dirname -- "$0")"

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
  pg_restore -U carlab -d carlab --clean --if-exists --no-owner --no-privileges --single-transaction <"$dump"

echo "==> Migrations"
docker compose run --rm -T medusa \
  node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing

./crawler-role.sh

docker compose up -d --wait --wait-timeout 300
echo "Restored."
