#!/bin/sh
set -eu
umask 077
cd "$(dirname -- "$0")"

dest=${BACKUP_DIR:-/var/backups/carlab}
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
mkdir -p "$dest"

find "$dest" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'static-*.tar.gz' \) -mtime +6 -delete

trap 'rm -f "$dest"/*"$stamp"*.part' EXIT

docker compose exec -T postgres \
  pg_dump -U carlab -d carlab --format=custom >"$dest/db-$stamp.dump.part"
mv "$dest/db-$stamp.dump.part" "$dest/db-$stamp.dump"

docker compose exec -T medusa \
  tar -C /server/static -czf - . >"$dest/static-$stamp.tar.gz.part"
mv "$dest/static-$stamp.tar.gz.part" "$dest/static-$stamp.tar.gz"

echo "Backed up to $dest/db-$stamp.dump and $dest/static-$stamp.tar.gz"
