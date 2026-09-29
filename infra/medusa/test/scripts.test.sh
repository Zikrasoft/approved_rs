#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"

cat >"$work/bin/docker" <<'STUB'
#!/bin/sh
echo "docker[${MEDUSA_TAG:-}] $*" >>"$LOG"
case "$*" in
*db:migrate*) exit "${MIGRATE_EXIT:-0}" ;;
*pg_dump*) printf 'DUMP' ;;
*'tar -C /server/static -czf'*) printf 'TAR' ;;
esac
STUB
cat >"$work/bin/curl" <<'STUB'
#!/bin/sh
echo "curl $*" >>"$LOG"
exit "${HEALTH_EXIT:-0}"
STUB
chmod +x "$work/bin/docker" "$work/bin/curl"

failures=0
expect() {
  name=$1
  shift
  if "$@"; then
    echo "ok - $name"
  else
    echo "not ok - $name"
    failures=$((failures + 1))
  fi
}
refuse() {
  name=$1
  shift
  if "$@"; then
    echo "not ok - $name"
    failures=$((failures + 1))
  else
    echo "ok - $name"
  fi
}

OLD=1111111111111111111111111111111111111111
NEW=2222222222222222222222222222222222222222

stage() {
  rm -rf "$work/host"
  mkdir "$work/host"
  cp "$here/deploy.sh" "$here/backup.sh" "$work/host/"
  printf 'API_HOST=api.test\nMEDUSA_TAG=%s\nPOSTGRES_PASSWORD=x\n' "$OLD" >"$work/host/.env"
  LOG="$work/host/log"
  export LOG
  : >"$LOG"
}
run() {
  PATH="$work/bin:$PATH" "$work/host/$1" "$2" >/dev/null 2>&1
}
logged() {
  printf '%s\n' "$@" | diff -u - "$LOG"
}
has() {
  grep -qx "$1" "$2"
}

stage
expect 'a deploy succeeds' run deploy.sh "$NEW"
expect 'pull, migrate, up, reload and health run in order on the new tag' logged \
  "docker[$NEW] compose pull --policy missing medusa" \
  "docker[$NEW] compose run --rm -T medusa node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing" \
  "docker[$NEW] compose up -d --wait --wait-timeout 300 --remove-orphans" \
  "docker[$NEW] compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile" \
  'curl -fsS -o /dev/null --max-time 10 --retry 12 --retry-delay 5 --retry-all-errors https://api.test/health/ready'
expect '.env names the new tag' has "MEDUSA_TAG=$NEW" "$work/host/.env"
expect '.env keeps every other line' has 'POSTGRES_PASSWORD=x' "$work/host/.env"
expect 'the old tag is kept for rollback' has "$OLD" "$work/host/.previous-tag"

stage
MIGRATE_EXIT=1
export MIGRATE_EXIT
refuse 'a failed migration fails the deploy' run deploy.sh "$NEW"
unset MIGRATE_EXIT
expect 'a failed migration leaves .env on the old tag' has "MEDUSA_TAG=$OLD" "$work/host/.env"
refuse 'a failed migration restarts nothing' grep -q 'up -d' "$LOG"

stage
HEALTH_EXIT=22
export HEALTH_EXIT
refuse 'a dead public endpoint fails the deploy' run deploy.sh "$NEW"
unset HEALTH_EXIT

for bad in latest '' 2222 "${NEW}0" GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG; do
  stage
  refuse "tag '$bad' is refused" run deploy.sh "$bad"
  refuse "tag '$bad' never reaches docker" test -s "$LOG"
done

stage
rm "$work/host/.env"
refuse 'no .env, no deploy' run deploy.sh "$NEW"
refuse 'no .env never reaches docker' test -s "$LOG"

stage
mkdir "$work/backups"
touch -t 202001010000 "$work/backups/db-old.dump" "$work/backups/static-old.tar.gz"
touch "$work/backups/db-recent.dump"
BACKUP_DIR="$work/backups"
export BACKUP_DIR
expect 'a backup succeeds' run backup.sh ''
expect 'the database dump lands in the backup dir' grep -qx DUMP "$work"/backups/db-2*.dump
expect 'the files archive lands in the backup dir' grep -qx TAR "$work"/backups/static-2*.tar.gz
refuse 'a week-old dump is removed' test -e "$work/backups/db-old.dump"
refuse 'a week-old files archive is removed' test -e "$work/backups/static-old.tar.gz"
expect 'a recent dump stays' test -e "$work/backups/db-recent.dump"
expect 'no .part file is left behind' test -z "$(find "$work/backups" -name '*.part')"

[ "$failures" -eq 0 ]
