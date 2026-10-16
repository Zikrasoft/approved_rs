#!/bin/sh
set -eu
umask 077
cd "$(dirname -- "$0")"

tag=${1:-}
case $tag in
'' | *[!0-9a-f]*)
  echo "usage: $0 <40-character commit sha>" >&2
  exit 2
  ;;
esac
[ "${#tag}" -eq 40 ] || {
  echo "usage: $0 <40-character commit sha>" >&2
  exit 2
}

[ -s .env ] || {
  echo "No .env next to $0. Write it from production.env.example first." >&2
  exit 1
}

mkdir .deploy.lock 2>/dev/null || {
  echo "A deploy or backup is already running (.deploy.lock present)." >&2
  exit 1
}
trap 'rmdir .deploy.lock 2>/dev/null || true' EXIT

previous=$(sed -n 's/^PARTS_BACKEND_TAG=//p' .env)
api_host=$(sed -n 's/^API_HOST=//p' .env)
image=$(sed -n 's/^PARTS_BACKEND_IMAGE=//p' .env)
image=${image:-ghcr.io/zikrasoft/podbor-parts-backend}
export PARTS_BACKEND_TAG="$tag"

echo "==> Image $tag"
docker compose pull --policy missing parts-backend

echo "==> Migrations"
docker compose run --rm -T parts-backend \
  node_modules/.bin/node-pg-migrate up

grep -v '^PARTS_BACKEND_TAG=' .env >.env.next
echo "PARTS_BACKEND_TAG=$tag" >>.env.next
mv .env.next .env
if [ -n "$previous" ] && [ "$previous" != "$tag" ]; then
  echo "$previous" >.previous-tag
fi
trap '[ $? -eq 0 ] || [ ! -s .previous-tag ] || echo "Roll back with: $0 $(cat .previous-tag)" >&2; rmdir .deploy.lock 2>/dev/null || true' EXIT

echo "==> Restarting"
docker compose up -d --wait --wait-timeout 300 --remove-orphans
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "==> https://${api_host:-parts.carlab.rs}/health"
if curl -fsS -o /dev/null --max-time 10 --retry 12 --retry-delay 5 --retry-all-errors \
  "https://${api_host:-parts.carlab.rs}/health"; then
  echo "Live at $tag."
  keep=$(cat .previous-tag 2>/dev/null || echo "$tag")
  docker image ls "$image" --format '{{.Tag}}' | grep -vx -e "$tag" -e "$keep" -e '<none>' -e '' | while read -r old; do
    docker image rm "$image:$old" >/dev/null || echo "Could not remove $image:$old." >&2
  done || true
else
  echo "The stack is up but the public health check failed." >&2
  exit 1
fi
