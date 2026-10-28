#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"

cat >"$work/bin/docker" <<'STUB'
#!/bin/sh
echo "docker[${MEDUSA_TAG:-}] $*" >>"$LOG"
if [ "$1" = run ]; then
  while [ "$#" -gt 0 ]; do
    [ "$1" = --env-file ] && cat "$2" >>"$LOG.env"
    shift
  done
  exit "${RCLONE_EXIT:-0}"
fi
case "$*" in
*db:migrate*) exit "${MIGRATE_EXIT:-0}" ;;
*seed-production*) exit "${SEED_EXIT:-0}" ;;
*pg_dump*)
  printf 'DUMP'
  exit "${PGDUMP_EXIT:-0}"
  ;;
*pg_tables*) printf '%s' "${TABLES:-0}" ;;
*'up -d --wait --wait-timeout'*) exit "${UP_EXIT:-0}" ;;
*'image ls'*) printf '%s\n' ${IMAGE_TAGS:-} ;;
*'image rm'*) exit "${RM_EXIT:-0}" ;;
esac
STUB
cat >"$work/bin/curl" <<'STUB'
#!/bin/sh
echo "curl $*" >>"$LOG"
case "$*" in
*'--config -'*)
  cat >>"$LOG.curl"
  exit "${TELEGRAM_EXIT:-0}"
  ;;
esac
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
BACKUP_DIR="$work/deploy-backups"
export BACKUP_DIR

stage() {
  rm -rf "$work/host"
  mkdir "$work/host"
  cp "$here/deploy.sh" "$here/backup.sh" "$here/restore.sh" "$work/host/"
  printf 'API_HOST=api.test\nMEDUSA_TAG=%s\nPOSTGRES_PASSWORD=x\nJWT_SECRET=leak-canary\n' "$OLD" >"$work/host/.env"
  LOG="$work/host/log"
  export LOG
  : >"$LOG"
  rm -f "$LOG.env" "$LOG.curl"
  rm -rf "$work/deploy-backups"
}
offsite() {
  printf 'BACKUP_S3_ENDPOINT=https://s3.test\nBACKUP_S3_BUCKET=carlab-backups\nBACKUP_S3_ACCESS_KEY_ID=key-canary\nBACKUP_S3_SECRET_ACCESS_KEY=secret-canary\n' >"$work/host/.env.backup"
}
crm() {
  printf 'TELEGRAM_BOT_TOKEN=bot-canary\nTELEGRAM_GROUP_ID=-100123\n' >>"$work/host/.env"
}
alerted() {
  grep -q 'api.telegram.org' "$LOG.curl" 2>/dev/null
}
run() {
  script=$1
  shift
  status=0
  (cd "$work/host" && PATH="$work/bin:$PATH" "./$script" "$@" >"$work/host/stdout" 2>"$work/host/stderr") || status=$?
  printed
}
run_from() {
  dir=$1
  script=$2
  shift 2
  status=0
  (cd "$dir" && PATH="$work/bin:$PATH" "$work/host/$script" "$@" >"$work/host/stdout" 2>"$work/host/stderr") || status=$?
  printed
}
printed() {
  cat "$work/host/stdout" "$work/host/stderr" >>"$work/printed"
  return "$status"
}
logged() {
  printf '%s\n' "$@" | diff -u - "$LOG"
}
has() {
  grep -qx "$1" "$2"
}

stage
expect 'a deploy succeeds' run deploy.sh "$NEW"
expect 'pull, migrate, seed, up, reload and health run in order on the new tag' logged \
  "docker[$NEW] compose pull --policy missing medusa" \
  "docker[$NEW] compose up -d --wait postgres" \
  "docker[$NEW] compose exec -T postgres pg_dump -U carlab -d carlab --format=custom" \
  "docker[$NEW] compose run --rm -T medusa node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing" \
  "docker[$NEW] compose run --rm -T medusa node_modules/.bin/medusa exec ./src/scripts/seed-production.js" \
  "docker[$NEW] compose up -d --wait --wait-timeout 300 --remove-orphans" \
  "docker[$NEW] compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile" \
  'curl -fsS -o /dev/null --max-time 10 --retry 12 --retry-delay 5 --retry-all-errors https://api.test/health/ready' \
  "docker[$NEW] image ls ghcr.io/zikrasoft/podbor-carlab-shop --format {{.Tag}}"
expect '.env names the new tag' has "MEDUSA_TAG=$NEW" "$work/host/.env"
expect '.env keeps every other line' has 'POSTGRES_PASSWORD=x' "$work/host/.env"
expect 'the old tag is kept for rollback' has "$OLD" "$work/host/.previous-tag"
expect 'the lock is released after a deploy' test ! -d "$work/host/.deploy.lock"
expect 'a deploy dumps the database before migrating' \
  test "$(cat "$work/deploy-backups"/db-*-pre-deploy.dump)" = DUMP
expect 'a deploy leaves no .part dump' test -z "$(find "$work/deploy-backups" -name '*.part')"

stage
PGDUMP_EXIT=1
export PGDUMP_EXIT
refuse 'a failed pre-deploy dump fails the deploy' run deploy.sh "$NEW"
unset PGDUMP_EXIT
refuse 'a failed pre-deploy dump migrates nothing' grep -q 'db:migrate' "$LOG"
expect 'a failed pre-deploy dump leaves .env on the old tag' has "MEDUSA_TAG=$OLD" "$work/host/.env"

OLDER=3333333333333333333333333333333333333333
stage
IMAGE_TAGS="$NEW $OLD $OLDER <none>"
export IMAGE_TAGS
expect 'a deploy with old images on the host succeeds' run deploy.sh "$NEW"
expect 'an image older than the previous one is removed' grep -qxF "docker[$NEW] image rm ghcr.io/zikrasoft/podbor-carlab-shop:$OLDER" "$LOG"
refuse 'the live and the previous image are kept' grep -Eq "image rm .*($NEW|$OLD)" "$LOG"
refuse 'an untagged image is not addressed by tag' grep -q 'image rm .*<none>' "$LOG"

stage
printf 'API_HOST=api.test\nMEDUSA_IMAGE=registry.test/medusa\nMEDUSA_TAG=%s\nPOSTGRES_PASSWORD=x\n' "$OLD" >"$work/host/.env"
expect 'a custom MEDUSA_IMAGE deploy succeeds' run deploy.sh "$NEW"
expect 'pruning follows MEDUSA_IMAGE from .env' grep -qxF "docker[$NEW] image rm registry.test/medusa:$OLDER" "$LOG"

stage
printf '%s\n' "$OLDER" >"$work/host/.previous-tag"
printf 'API_HOST=api.test\nMEDUSA_TAG=%s\nPOSTGRES_PASSWORD=x\n' "$NEW" >"$work/host/.env"
expect 'a redeploy of the live tag succeeds' run deploy.sh "$NEW"
refuse 'a redeploy keeps the recorded rollback image' grep -q "image rm .*$OLDER" "$LOG"

stage
RM_EXIT=1
export RM_EXIT
expect 'a failed image removal does not fail the deploy' run deploy.sh "$NEW"
unset RM_EXIT IMAGE_TAGS

stage
MIGRATE_EXIT=1
export MIGRATE_EXIT
refuse 'a failed migration fails the deploy' run deploy.sh "$NEW"
unset MIGRATE_EXIT
expect 'a failed migration leaves .env on the old tag' has "MEDUSA_TAG=$OLD" "$work/host/.env"
refuse 'a failed migration restarts nothing' grep -q 'up -d --wait --wait-timeout' "$LOG"
expect 'a failed migration releases the lock' test ! -d "$work/host/.deploy.lock"

stage
SEED_EXIT=1
export SEED_EXIT
refuse 'a failed seed fails the deploy' run deploy.sh "$NEW"
unset SEED_EXIT
expect 'a failed seed leaves .env on the old tag' has "MEDUSA_TAG=$OLD" "$work/host/.env"
refuse 'a failed seed restarts nothing' grep -q 'up -d --wait --wait-timeout' "$LOG"

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
mkdir -p "$work/deploy-backups"
for old in 2026-01-01T00-00-00Z 2026-01-02T00-00-00Z 2026-01-03T00-00-00Z 2026-01-04T00-00-00Z; do
  printf 'OLD' >"$work/deploy-backups/db-$old-pre-deploy.dump"
done
printf 'NIGHTLY' >"$work/deploy-backups/db-2026-01-01T03-30-00Z.dump"
expect 'a deploy with older pre-deploy dumps succeeds' run deploy.sh "$NEW"
expect 'only the last three pre-deploy dumps are kept' \
  test "$(find "$work/deploy-backups" -name 'db-*-pre-deploy.dump' | wc -l | tr -d ' ')" -eq 3
expect 'the new pre-deploy dump is among them' test -n "$(grep -lx DUMP "$work/deploy-backups"/db-*-pre-deploy.dump)"
refuse 'the oldest pre-deploy dumps go' test -e "$work/deploy-backups/db-2026-01-02T00-00-00Z-pre-deploy.dump"
expect 'the newest older pre-deploy dumps stay' test -e "$work/deploy-backups/db-2026-01-04T00-00-00Z-pre-deploy.dump"
expect 'pre-deploy retention leaves nightly dumps alone' test -e "$work/deploy-backups/db-2026-01-01T03-30-00Z.dump"

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
expect 'a restore succeeds' run restore.sh db.dump
expect 'restore checks tables, restores the database, migrates, then restarts, in order' logged \
  "docker[] compose up -d --wait postgres" \
  "docker[] compose exec -T postgres psql -U carlab -d carlab -tAc select count(*) from pg_tables where schemaname = 'public'" \
  "docker[] compose stop medusa" \
  "docker[] compose exec -T postgres pg_restore -U carlab -d carlab --clean --if-exists --no-owner --single-transaction" \
  "docker[] compose run --rm -T medusa node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing" \
  "docker[] compose up -d --wait --wait-timeout 300"

stage
mkdir "$work/elsewhere"
printf 'DUMP' >"$work/elsewhere/db.dump"
expect 'a relative dump path resolves against the invocation directory' run_from "$work/elsewhere" restore.sh db.dump

stage
mkdir "$work/backups"
touch -t 202001010000 "$work/backups/db-old.dump" "$work/backups/db-old-notes.txt" "$work/backups/db-old-pre-deploy.dump"
touch "$work/backups/db-recent.dump"
BACKUP_DIR="$work/backups"
export BACKUP_DIR
expect 'a backup succeeds' run backup.sh ''
expect 'the database dump lands in the backup dir' grep -qx DUMP "$work"/backups/db-2*.dump
refuse 'a week-old dump is removed' test -e "$work/backups/db-old.dump"
expect 'a week-old pre-deploy dump is left to the deploy retention' test -e "$work/backups/db-old-pre-deploy.dump"
expect 'a recent dump stays' test -e "$work/backups/db-recent.dump"
expect 'an unrelated old file is not rotated away' test -e "$work/backups/db-old-notes.txt"
refuse 'a backup without a CRM bot posts nothing' alerted
expect 'no .part file is left behind' test -z "$(find "$work/backups" -name '*.part')"

stage
mkdir "$work/host/.deploy.lock" "$work/backups3"
BACKUP_DIR="$work/backups3"
export BACKUP_DIR
refuse 'a running deploy makes the backup fail' run backup.sh ''
expect 'a skipped backup says why' grep -q 'deploy is running' "$work/host/stderr"
refuse 'a skipped backup never reaches docker' test -s "$LOG"
expect 'a skipped backup leaves the deploy lock alone' test -d "$work/host/.deploy.lock"

stage
crm
mkdir "$work/host/.deploy.lock"
BACKUP_DIR="$work/backups3"
refuse 'a backup skipped for a deploy fails' run backup.sh ''
expect 'a skipped backup alerts the CRM group' alerted
expect 'a skipped backup leaves the deploy lock alone when it alerts' test -d "$work/host/.deploy.lock"

stage
crm
BACKUP_DIR="$work/backups3"
expect 'a backup with a CRM bot succeeds' run backup.sh ''
refuse 'a successful backup posts nothing' alerted

stage
BACKUP_DIR="$work/backups3"
expect 'a backup releases the lock' run backup.sh ''
expect 'no lock is left after a backup' test ! -d "$work/host/.deploy.lock"

stage
mkdir "$work/backups2"
PGDUMP_EXIT=1
BACKUP_DIR="$work/backups2"
export PGDUMP_EXIT BACKUP_DIR
refuse 'a failing pg_dump fails the backup' run backup.sh ''
expect 'a failing pg_dump leaves no .part file' test -z "$(find "$work/backups2" -name '*.part')"
refuse 'a failing pg_dump without a CRM bot posts nothing' alerted

stage
crm
BACKUP_DIR="$work/backups2"
refuse 'a failing pg_dump with a CRM bot fails the backup' run backup.sh ''
expect 'a failing pg_dump alerts the CRM group' alerted
expect 'the alert goes to the CRM group' grep -q 'chat_id=-100123' "$LOG"
expect 'the alert names the shop backup' grep -q 'text=.*backup' "$LOG"
expect 'the bot token reaches curl only through its config on stdin' grep -q 'bot-canary' "$LOG.curl"
refuse 'the bot token never reaches a command line' grep -q 'bot-canary' "$LOG"
TELEGRAM_EXIT=7
export TELEGRAM_EXIT
stage
crm
BACKUP_DIR="$work/backups2"
refuse 'a backup still fails when the alert cannot be sent' run backup.sh ''
unset TELEGRAM_EXIT
unset PGDUMP_EXIT

stage
mkdir "$work/backups4"
BACKUP_DIR="$work/backups4"
export BACKUP_DIR
expect 'a backup without a bucket succeeds' run backup.sh
expect 'a backup without a bucket warns that it stays on this host' grep -q 'BACKUP_S3_BUCKET is not set' "$work/host/stderr"
refuse 'a backup without a bucket uploads nothing' grep -q 'docker\[[^]]*\] run' "$LOG"

stage
offsite
BACKUP_DIR="$work/backups4"
expect 'a backup with a bucket succeeds' run backup.sh
expect 'the new dump goes to the bucket through a pinned rclone image' \
  grep -Eq "run --rm .*-v $work/backups4:/backups rclone/rclone:[0-9]+\.[0-9]+\.[0-9]+ copy /backups :s3:carlab-backups --include \*-2[^ ]*Z\.\*$" "$LOG"
expect 'copies older than 30 days are deleted from the bucket' \
  grep -Eq "rclone/rclone:[0-9.]+ delete :s3:carlab-backups --min-age 30d --include db-\*\.dump$" "$LOG"
expect 'rclone gets the endpoint and keys through an env file' grep -qx 'RCLONE_S3_SECRET_ACCESS_KEY=secret-canary' "$LOG.env"
expect 'the env file carries only the bucket credentials' test "$(grep -c . "$LOG.env")" -eq "$(grep -c '^RCLONE_S3_' "$LOG.env")"
refuse 'no key reaches a command line' grep -q 'canary' "$LOG"
expect 'no env file is left behind' test -z "$(find "$work/host" "${TMPDIR:-/tmp}" -maxdepth 1 -name 'carlab-offsite.*' 2>/dev/null)"

stage
offsite
mkdir "$work/backups5"
RCLONE_EXIT=1
BACKUP_DIR="$work/backups5"
export RCLONE_EXIT BACKUP_DIR
refuse 'a failed upload fails the backup' run backup.sh
expect 'a failed upload says so' grep -q 'off-host copy failed' "$work/host/stderr"
expect 'a failed upload keeps the local dump' test -n "$(find "$work/backups5" -name 'db-*.dump')"
expect 'a failed upload releases the lock' test ! -d "$work/host/.deploy.lock"
stage
offsite
crm
refuse 'a failed upload with a CRM bot fails the backup' run backup.sh
expect 'a failed upload alerts the CRM group' alerted
unset RCLONE_EXIT

stage
offsite
mkdir "$work/backups6"
BACKUP_DIR="$work/backups6"
expect 'fetch lists the bucket' run backup.sh fetch
expect 'listing the bucket goes through rclone' grep -Eq 'rclone/rclone:[0-9.]+ lsf :s3:carlab-backups$' "$LOG"
stage
offsite
expect 'fetch downloads one stamp' run backup.sh fetch 2026-10-23T03-30-00Z
expect 'fetch copies that stamp into the backup dir' \
  grep -Eq "run --rm .*-v $work/backups6:/backups rclone/rclone:[0-9.]+ copy :s3:carlab-backups /backups --include \*-2026-10-23T03-30-00Z\.\*$" "$LOG"
refuse 'fetch takes no deploy lock and dumps nothing' grep -q 'compose' "$LOG"
stage
refuse 'fetch without a bucket fails' run backup.sh fetch
unset BACKUP_DIR

expect "the scripts ran and printed something" test -s "$work/printed"
refuse "no script prints a secret from .env" grep -Eq 'leak-canary|secret-canary|key-canary|bot-canary' "$work/printed"

expect 'the image health check asks Postgres and Typesense through /health/ready' \
  grep -q 'http://127.0.0.1:9000/health/ready ' "$here/Dockerfile"
expect 'the production image carries the Sentry SDK' grep -q "require('@sentry/node')" "$here/Dockerfile"
expect 'the env template names SENTRY_DSN, empty until the owner has a project' \
  grep -qx 'SENTRY_DSN=' "$here/production.env.example"

[ "$failures" -eq 0 ]
