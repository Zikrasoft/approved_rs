#!/bin/sh
set -eu
trap '' HUP
cd "$(dirname -- "$0")"

app=${1:-}
name=${2:-}
usage() {
  echo "usage: $0 <app> <release name: 40-character commit sha, then -run-attempt>" >&2
  exit 2
}
case $app in
'' | -* | *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) usage ;;
esac
case $name in
'' | *[!0-9a-f-]*) usage ;;
esac
sha=${name%%-*}
[ "${#sha}" -eq 40 ] || usage

site=${SITES_ROOT:-/srv/sites}/$app
release=releases/$name
[ -f "$site/$release/server/entry.mjs" ] || {
  echo "No $site/$release/server/entry.mjs: upload the release first." >&2
  exit 1
}
[ -f "$site/$release/.env" ] || {
  echo "No $site/$release/.env: upload the release with its env." >&2
  exit 1
}

previous=$(readlink "$site/running" 2>/dev/null || readlink "$site/current" 2>/dev/null || true)
chmod -R a+rX "$site/$release"
chmod 600 "$site/$release/.env"
touch "$site/$release"

point() {
  ln -sfn "$2" "$site/$1.next"
  mv -T "$site/$1.next" "$site/$1"
}
start() {
  docker compose up -d --wait --wait-timeout 120 --no-deps --force-recreate "site-$app"
}

point running "$release"
if ! start; then
  if [ -z "$previous" ]; then
    rm -f "$site/running"
    docker compose rm -sf "site-$app" || true
    echo "site-$app failed its health check on its first release $name, nothing is serving it." >&2
  elif [ "$previous" != "$release" ]; then
    point running "$previous"
    start || true
    echo "site-$app failed its health check on $name, rolled back to ${previous#releases/}." >&2
  else
    echo "site-$app failed its health check on $name, which was already live." >&2
  fi
  [ "$previous" = "$release" ] || [ "$(readlink "$site/current" 2>/dev/null)" = "$release" ] || rm -rf "${site:?}/$release"
  exit 1
fi
point current "$release"
if [ "$app" = auto-service ] && ! docker compose exec -T caddy curl -fsS -X PURGE http://127.0.0.1:2019/souin-api/souin/flush; then
  echo "site-$app is live at $name, but its page cache was not emptied: visitors may get pages from the previous release for a day." >&2
  exit 1
fi
if [ "$app" = auto-service ]; then
  docker compose exec -T -d medusa node_modules/.bin/medusa exec ./src/scripts/warm-pages.js ||
    echo "site-$app is live at $name, but the page warm-up did not start: the first visitors will find cold pages." >&2
fi

find "$site/releases" -mindepth 1 -maxdepth 1 -type d -exec ls -1dt {} + | tail -n +3 | while read -r old; do
  [ "$old" = "$site/$release" ] || rm -rf "$old"
done
echo "site-$app is live at $name."
