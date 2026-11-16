#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin" "$work/host"
cp "$here/deploy-site.sh" "$here/reminders.sh" "$work/host/"

cat >"$work/bin/docker" <<'STUB'
#!/bin/sh
echo "docker $* -> $(readlink "$SITES_ROOT/$APP/running" 2>/dev/null || echo none) (caddy $(readlink "$SITES_ROOT/$APP/current" 2>/dev/null || echo none))" >>"$LOG"
case "$*" in
*'up -d --wait'*)
  case "$(readlink "$SITES_ROOT/$APP/running")" in
  *"${BROKEN:-none}") exit 1 ;;
  esac
  ;;
*'exec -T site-approved-rs'*) exit "${REMINDERS_EXIT:-0}" ;;
esac
STUB
chmod +x "$work/bin/docker"
if ! mv -T "$work/bin" "$work/bin" 2>/dev/null; then
  cat >"$work/bin/mv" <<'STUB'
#!/bin/sh
[ "$1" = -T ] && shift && set -- -h "$@"
exec /bin/mv "$@"
STUB
  chmod +x "$work/bin/mv"
fi

called() {
  tr '\n' ' ' <"$LOG" | grep -q "$1"
}

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

A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-101-1
B=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-102-1
C=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-103-2
D=dddddddddddddddddddddddddddddddddddddddd-104-1
E=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-105-1
SITES_ROOT="$work/sites"
LOG="$work/log"
APP=detailing
export SITES_ROOT LOG APP

fresh() {
  rm -rf "$SITES_ROOT"
  mkdir -p "$SITES_ROOT/$APP/releases"
  : >"$LOG"
  unset BROKEN
}
ship() {
  mkdir -p "$SITES_ROOT/$APP/releases/$1/server" "$SITES_ROOT/$APP/releases/$1/client"
  echo "$1" >"$SITES_ROOT/$APP/releases/$1/server/entry.mjs"
  chmod 0600 "$SITES_ROOT/$APP/releases/$1/server/entry.mjs"
  echo "RELEASE=$1" >"$SITES_ROOT/$APP/releases/$1/.env"
  chmod 0600 "$SITES_ROOT/$APP/releases/$1/.env"
}
mode() {
  stat -c %a "$1" 2>/dev/null || stat -f %Lp "$1"
}
run() {
  status=0
  PATH="$work/bin:$PATH" "$work/host/$1" "$2" "$3" >"$work/stdout" 2>"$work/stderr" || status=$?
  return "$status"
}
current() {
  [ "$(readlink "$SITES_ROOT/$APP/current")" = "releases/$1" ] && [ "$(readlink "$SITES_ROOT/$APP/running")" = "releases/$1" ]
}
released() {
  [ "$(find "$SITES_ROOT/$APP/releases" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" -eq "$1" ]
}

fresh
ship "$A"
expect 'a first release deploys' run deploy-site.sh "$APP" "$A"
expect 'current points at the first release' current "$A"
expect 'the site is recreated on the new release and waited for before caddy serves it' \
  grep -qx "docker compose up -d --wait --wait-timeout 120 --no-deps --force-recreate site-$APP -> releases/$A (caddy none)" "$LOG"
expect 'the release is readable by the containers' \
  test "$(mode "$SITES_ROOT/$APP/releases/$A/server/entry.mjs")" = 644
expect 'the release env stays owner-only' \
  test "$(mode "$SITES_ROOT/$APP/releases/$A/.env")" = 600
refuse 'no temporary link is left behind' test -L "$SITES_ROOT/$APP/current.next"
refuse 'no temporary running link is left behind' test -L "$SITES_ROOT/$APP/running.next"

ship "$B"
expect 'a second release deploys' run deploy-site.sh "$APP" "$B"
expect 'current moves to the second release' current "$B"
expect 'caddy keeps the old static files until the new container is healthy' \
  grep -qx "docker compose up -d --wait --wait-timeout 120 --no-deps --force-recreate site-$APP -> releases/$B (caddy releases/$A)" "$LOG"

ship "$C"
BROKEN=$C
export BROKEN
refuse 'a release that fails its health check fails the deploy' run deploy-site.sh "$APP" "$C"
expect 'a failed release rolls current back' current "$B"
expect 'the site is recreated on the previous release' \
  test "$(tail -n 1 "$LOG")" = "docker compose up -d --wait --wait-timeout 120 --no-deps --force-recreate site-$APP -> releases/$B (caddy releases/$B)"
refuse 'caddy never serves the static files of a failed release' grep -q "caddy releases/$C" "$LOG"
expect 'a failed release says so' grep -q "rolled back to $B" "$work/stderr"
expect 'a rollback brings back the env the previous release ran with' \
  grep -qx "RELEASE=$B" "$SITES_ROOT/$APP/running/.env"
expect 'a rebuild of the live sha left the live release untouched' grep -qx "$B" "$SITES_ROOT/$APP/releases/$B/server/entry.mjs"
refuse 'a release that never went live is removed' test -e "$SITES_ROOT/$APP/releases/$C"
unset BROKEN

ship "$D"
sleep 1
expect 'a fourth release deploys' run deploy-site.sh "$APP" "$D"
expect 'a failed release does not count toward the three kept' released 3
ship "$E"
sleep 1
expect 'a fifth release deploys' run deploy-site.sh "$APP" "$E"
expect 'only the last three releases stay' released 3
refuse 'the oldest release is pruned' test -e "$SITES_ROOT/$APP/releases/$A"
expect 'the previous release stays for rollback' test -e "$SITES_ROOT/$APP/releases/$D"

sleep 1
expect 'a redeploy of an older release succeeds' run deploy-site.sh "$APP" "$B"
expect 'the redeployed release is current' current "$B"
expect 'pruning never removes the release just made current' test -e "$SITES_ROOT/$APP/releases/$B"
expect 'a redeploy of the live release is idempotent' run deploy-site.sh "$APP" "$B"
expect 'the release survives an idempotent redeploy' current "$B"

fresh
ship "$A"
BROKEN=$A
export BROKEN
refuse 'a broken first release fails the deploy' run deploy-site.sh "$APP" "$A"
refuse 'a broken first release leaves no current link' test -L "$SITES_ROOT/$APP/current"
refuse 'a broken first release leaves no running link' test -L "$SITES_ROOT/$APP/running"
expect 'a broken first release stops its container' grep -q "docker compose rm -sf site-$APP" "$LOG"
unset BROKEN

fresh
ship "$A"
ship "$B"
run deploy-site.sh "$APP" "$A"
sleep 1
run deploy-site.sh "$APP" "$B"
for broken in "$C" "$D"; do
  ship "$broken"
  sleep 1
  BROKEN=$broken
  export BROKEN
  run deploy-site.sh "$APP" "$broken" || true
done
unset BROKEN
ship "$E"
sleep 1
expect 'a release after two failed ones deploys' run deploy-site.sh "$APP" "$E"
expect 'failed releases never push the last good one out' test -e "$SITES_ROOT/$APP/releases/$B"
expect 'releases that never went live are gone' released 3

fresh
ship "$A"
run deploy-site.sh "$APP" "$A"
rm "$SITES_ROOT/$APP/running"
ship "$B"
BROKEN=$B
export BROKEN
: >"$LOG"
refuse 'a broken release on a host without a running link fails the deploy' run deploy-site.sh "$APP" "$B"
expect 'a host without a running link rolls back to current' current "$A"
expect 'the site is recreated on the current release' \
  test "$(tail -n 1 "$LOG")" = "docker compose up -d --wait --wait-timeout 120 --no-deps --force-recreate site-$APP -> releases/$A (caddy releases/$A)"
refuse 'a host without a running link never removes the container' grep -q "rm -sf" "$LOG"
unset BROKEN

fresh
refuse 'a release that was not uploaded is refused' run deploy-site.sh "$APP" "$A"
refuse 'a missing release never reaches docker' test -s "$LOG"

fresh
ship "$A"
rm "$SITES_ROOT/$APP/releases/$A/.env"
refuse 'a release uploaded without its env is refused' run deploy-site.sh "$APP" "$A"
refuse 'a release without its env never reaches docker' test -s "$LOG"

fresh
ship "$A"
for bad in shop ../detailing detailing/ . .. Detailing ''; do
  refuse "app '$bad' is refused" run deploy-site.sh "$bad" "$A"
done
for bad in latest 2222 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0-1-1 -aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ../../x "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1/x"; do
  refuse "release name '$bad' is refused" run deploy-site.sh "$APP" "$bad"
done
refuse 'a refused deploy never reaches docker' test -s "$LOG"

APP=new-brand
fresh
ship "$A"
expect 'a site with an uploaded release deploys without a list naming it' run deploy-site.sh "$APP" "$A"

APP=approved-rs
fresh
expect 'reminders before the first approved.rs release do nothing' run reminders.sh '' ''
refuse 'reminders without a release never reach docker' test -s "$LOG"
ship "$A"
run deploy-site.sh "$APP" "$A"
: >"$LOG"
expect 'reminders run once approved.rs is live' run reminders.sh '' ''
expect 'reminders call the route inside the approved.rs container with its own CRON_SECRET, whatever COMPOSE_PROFILES says' \
  called 'docker compose --profile site-approved-rs exec -T site-approved-rs node -e .*/api/reminders.*process.env.CRON_SECRET'
REMINDERS_EXIT=1
export REMINDERS_EXIT
refuse 'a failed reminders run fails the unit' run reminders.sh '' ''
unset REMINDERS_EXIT

sites_of() {
  sort -u | tr '\n' ' '
}
manifest=$(jq -r '.sites | keys[]' "$here/../../.github/scripts/site-env.json" | sites_of)
expect 'site-env.json names the sites' test -n "$manifest"
expect 'compose runs a container for every site in site-env.json and no other' \
  test "$(sed -n 's/^  site-\([a-z0-9-]*\):$/\1/p' "$here/docker-compose.yml" | sites_of)" = "$manifest"
expect 'caddy serves every site in site-env.json and no other' \
  test "$(sed -n 's/^[[:space:]]*import site \([a-z0-9-]*\)$/\1/p' "$here/caddy/Caddyfile" | sites_of)" = "$manifest"

[ "$failures" -eq 0 ]
