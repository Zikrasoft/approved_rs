#!/bin/sh
set -eu
umask 077
cd "$(dirname -- "$0")"

dest=${BACKUP_DIR:-/var/backups/parts-backend}
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
mkdir -p "$dest"

find "$dest" -maxdepth 1 -type f -name 'db-*.dump' -mtime +6 -delete

mkdir .deploy.lock 2>/dev/null || {
  echo "A deploy is running (.deploy.lock present) — no backup tonight." >&2
  exit 1
}
trap 'rm -f "$dest"/*"$stamp"*.part; rmdir .deploy.lock 2>/dev/null || true' EXIT

docker compose exec -T postgres \
  pg_dump -U partsshop -d partsshop --format=custom >"$dest/db-$stamp.dump.part"
mv "$dest/db-$stamp.dump.part" "$dest/db-$stamp.dump"

echo "Backed up to $dest/db-$stamp.dump"
