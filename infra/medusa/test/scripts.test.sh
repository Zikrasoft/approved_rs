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
*pg_dump*)
  printf 'DUMP'
  exit "${PGDUMP_EXIT:-0}"
  ;;
*'tar -C /server/static -czf'*) printf 'TAR' ;;
*pg_tables*) printf '%s' "${TABLES:-0}" ;;
*'up -d --wait'*) exit "${UP_EXIT:-0}" ;;
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
  cp "$here/deploy.sh" "$here/backup.sh" "$here/restore.sh" "$work/host/"
  printf 'API_HOST=api.test\nMEDUSA_TAG=%s\nPOSTGRES_PASSWORD=x\n' "$OLD" >"$work/host/.env"
  LOG="$work/host/log"
  export LOG
  : >"$LOG"
}
run() {
  script=$1
  shift
  (cd "$work/host" && PATH="$work/bin:$PATH" "./$script" "$@" >/dev/null 2>"$work/host/stderr")
}
run_from() {
  dir=$1
  script=$2
  shift 2
  (cd "$dir" && PATH="$work/bin:$PATH" "$work/host/$script" "$@" >/dev/null 2>"$work/host/stderr")
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
expect 'the lock is released after a deploy' test ! -d "$work/host/.deploy.lock"

stage
MIGRATE_EXIT=1
export MIGRATE_EXIT
refuse 'a failed migration fails the deploy' run deploy.sh "$NEW"
unset MIGRATE_EXIT
expect 'a failed migration leaves .env on the old tag' has "MEDUSA_TAG=$OLD" "$work/host/.env"
refuse 'a failed migration restarts nothing' grep -q 'up -d' "$LOG"
expect 'a failed migration releases the lock' test ! -d "$work/host/.deploy.lock"

stage
HEALTH_EXIT=22
export HEALTH_EXIT
refuse 'a dead public endpoint fails the deploy' run deploy.sh "$NEW"
unset HEALTH_EXIT
expect 'a dead public endpoint prints the rollback command' grep -Eq "Roll back with: .*$OLD" "$work/host/stderr"

stage
UP_EXIT=1
export UP_EXIT
refuse 'a failed restart fails the deploy' run deploy.sh "$NEW"
unset UP_EXIT
expect 'a failed restart prints the rollback command' grep -Eq "Roll back with: .*$OLD" "$work/host/stderr"
expect 'the lock is released after a failed restart' test ! -d "$work/host/.deploy.lock"

stage
mkdir "$work/host/.deploy.lock"
refuse 'a held lock refuses the deploy' run deploy.sh "$NEW"
refuse 'a held lock never reaches docker' test -s "$LOG"

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
refuse 'a missing dump refuses the restore' run restore.sh no-such-file.dump
refuse 'a missing dump never reaches docker' test -s "$LOG"

stage
printf 'DUMP' >"$work/host/db.dump"
TABLES=5
export TABLES
refuse 'restore refuses over existing tables' run restore.sh db.dump
refuse 'a refused restore never calls pg_restore' grep -q pg_restore "$LOG"
unset TABLES

stage
printf 'DUMP' >"$work/host/db.dump"
TABLES=5
RESTORE_OVER_EXISTING=yes
export TABLES RESTORE_OVER_EXISTING
expect 'restore proceeds with RESTORE_OVER_EXISTING=yes' run restore.sh db.dump
expect 'an allowed restore calls pg_restore' grep -q pg_restore "$LOG"
unset TABLES RESTORE_OVER_EXISTING

stage
printf 'DUMP' >"$work/host/db.dump"
printf 'TAR' >"$work/host/static.tar.gz"
expect 'a restore succeeds' run restore.sh db.dump static.tar.gz
expect 'restore checks tables, restores the database and files, migrates, then restarts, in order' logged \
  "docker[] compose up -d --wait postgres" \
  "docker[] compose exec -T postgres psql -U carlab -d carlab -tAc select count(*) from pg_tables where schemaname = 'public'" \
  "docker[] compose stop medusa" \
  "docker[] compose exec -T postgres pg_restore -U carlab -d carlab --clean --if-exists --no-owner --single-transaction" \
  "docker[] compose run --rm -T --no-deps --entrypoint sh medusa -c find /server/static -mindepth 1 -delete && tar -C /server/static -xzf -" \
  "docker[] compose run --rm -T medusa node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing" \
  "docker[] compose up -d --wait --wait-timeout 300"

stage
mkdir "$work/elsewhere"
printf 'DUMP' >"$work/elsewhere/db.dump"
expect 'a relative dump path resolves against the invocation directory' run_from "$work/elsewhere" restore.sh db.dump

stage
mkdir "$work/backups"
touch -t 202001010000 "$work/backups/db-old.dump" "$work/backups/static-old.tar.gz" "$work/backups/db-old-notes.txt"
touch "$work/backups/db-recent.dump"
BACKUP_DIR="$work/backups"
export BACKUP_DIR
expect 'a backup succeeds' run backup.sh ''
expect 'the database dump lands in the backup dir' grep -qx DUMP "$work"/backups/db-2*.dump
expect 'the files archive lands in the backup dir' grep -qx TAR "$work"/backups/static-2*.tar.gz
refuse 'a week-old dump is removed' test -e "$work/backups/db-old.dump"
refuse 'a week-old files archive is removed' test -e "$work/backups/static-old.tar.gz"
expect 'a recent dump stays' test -e "$work/backups/db-recent.dump"
expect 'an unrelated old file is not rotated away' test -e "$work/backups/db-old-notes.txt"
expect 'no .part file is left behind' test -z "$(find "$work/backups" -name '*.part')"

stage
mkdir "$work/backups2"
PGDUMP_EXIT=1
BACKUP_DIR="$work/backups2"
export PGDUMP_EXIT BACKUP_DIR
refuse 'a failing pg_dump fails the backup' run backup.sh ''
expect 'a failing pg_dump leaves no .part file' test -z "$(find "$work/backups2" -name '*.part')"
unset PGDUMP_EXIT

[ "$failures" -eq 0 ]
