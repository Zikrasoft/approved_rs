#!/bin/sh
set -eu
umask 077
cd "$(dirname -- "$0")"

dest=${BACKUP_DIR:-/var/backups/carlab}
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
bucket=$(sed -n 's/^BACKUP_S3_BUCKET=//p' .env.backup 2>/dev/null | tail -n 1)
mkdir -p "$dest"

rclone() {
  creds=$(mktemp "${TMPDIR:-/tmp}/carlab-offsite.XXXXXX")
  sed -nE 's/^BACKUP_S3_(ENDPOINT|REGION|ACCESS_KEY_ID|SECRET_ACCESS_KEY)=/RCLONE_S3_\1=/p' .env.backup >"$creds"
  status=0
  docker run --rm --user "$(id -u):$(id -g)" --env-file "$creds" \
    -e RCLONE_S3_PROVIDER=Other -e RCLONE_S3_NO_CHECK_BUCKET=true \
    -v "$dest:/backups" rclone/rclone:1.75.2 "$@" || status=$?
  rm -f "$creds"
  return "$status"
}

if [ "${1:-}" = fetch ]; then
  [ -n "$bucket" ] || {
    echo "BACKUP_S3_BUCKET is not set in .env.backup: there is no off-host copy to fetch." >&2
    exit 2
  }
  if [ -z "${2:-}" ]; then
    rclone lsf ":s3:$bucket"
  else
    rclone copy ":s3:$bucket" /backups --include "*-$2.*"
    echo "Fetched $2 into $dest"
  fi
  exit 0
fi

alert() {
  [ "$1" -eq 0 ] && return 0
  token=$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' .env 2>/dev/null | tail -n 1)
  group=$(sed -n 's/^TELEGRAM_GROUP_ID=//p' .env 2>/dev/null | tail -n 1)
  [ -n "$token" ] && [ -n "$group" ] || return 0
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -fs --max-time 20 --config - --data-urlencode "chat_id=$group" \
      --data-urlencode "text=CarLab shop: the nightly backup on $(hostname) failed (exit $1). See /var/log/carlab-backup.log." \
      >/dev/null 2>&1 || echo "Could not post the failure to Telegram." >&2
  return 0
}
trap 'alert $?' EXIT

find "$dest" -maxdepth 1 -type f -name 'db-*.dump' ! -name '*-pre-deploy.dump' -mtime +6 -delete

mkdir .deploy.lock 2>/dev/null || {
  echo "A deploy is running (.deploy.lock present), no backup tonight." >&2
  exit 1
}
release() {
  exited=$?
  rm -f "$dest"/*"$stamp"*.part
  rmdir .deploy.lock 2>/dev/null || true
  alert "$exited"
}
trap release EXIT

docker compose exec -T postgres \
  pg_dump -U carlab -d carlab --format=custom >"$dest/db-$stamp.dump.part"
mv "$dest/db-$stamp.dump.part" "$dest/db-$stamp.dump"
rmdir .deploy.lock

echo "Backed up to $dest/db-$stamp.dump"

if [ -z "$bucket" ]; then
  echo "WARNING: BACKUP_S3_BUCKET is not set in .env.backup, so this backup stays on this host only." >&2
  exit 0
fi
{
  rclone copy /backups ":s3:$bucket" --include "*-$stamp.*" &&
    rclone delete ":s3:$bucket" --min-age 30d --include 'db-*.dump'
} || {
  echo "The off-host copy failed; the local backup in $dest is intact." >&2
  exit 1
}
echo "Copied to the $bucket bucket"
