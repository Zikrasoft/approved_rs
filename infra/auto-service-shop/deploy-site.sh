#!/bin/sh
set -eu
cd "$(dirname -- "$0")"

app=${1:-}
name=${2:-}
usage() {
  echo "usage: $0 <auto-service|detailing|approved-rs> <release name: 40-character commit sha, then -run-attempt>" >&2
  exit 2
}
case $app in
auto-service | detailing | approved-rs) ;;
*) usage ;;
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

previous=$(readlink "$site/current" 2>/dev/null || true)
chmod -R a+rX "$site/$release"
touch "$site/$release"

point() {
  ln -sfn "$1" "$site/current.next"
  mv -T "$site/current.next" "$site/current"
}
start() {
  docker compose up -d --wait --wait-timeout 120 --no-deps --force-recreate "site-$app"
}

point "$release"
if ! start; then
  if [ -z "$previous" ]; then
    rm -f "$site/current"
    docker compose rm -sf "site-$app" || true
    echo "site-$app failed its health check on its first release $name, nothing is serving it." >&2
  elif [ "$previous" != "$release" ]; then
    point "$previous"
    start || true
    echo "site-$app failed its health check on $name, rolled back to ${previous#releases/}." >&2
  else
    echo "site-$app failed its health check on $name, which was already live." >&2
  fi
  exit 1
fi

find "$site/releases" -mindepth 1 -maxdepth 1 -type d -exec ls -1dt {} + | tail -n +4 | while read -r old; do
  [ "$old" = "$site/$release" ] || rm -rf "$old"
done
echo "site-$app is live at $name."
