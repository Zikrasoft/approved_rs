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

previous=$(sed -n 's/^MEDUSA_TAG=//p' .env)
api_host=$(sed -n 's/^API_HOST=//p' .env)
export MEDUSA_TAG="$tag"

echo "==> Image $tag"
docker compose pull --policy missing medusa

echo "==> Migrations"
docker compose run --rm -T medusa \
  node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing

grep -v '^MEDUSA_TAG=' .env >.env.next
echo "MEDUSA_TAG=$tag" >>.env.next
mv .env.next .env
if [ -n "$previous" ] && [ "$previous" != "$tag" ]; then
  echo "$previous" >.previous-tag
fi

echo "==> Restarting"
docker compose up -d --wait --wait-timeout 300 --remove-orphans
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "==> https://${api_host:-api.carlab.rs}/health/ready"
if curl -fsS -o /dev/null --max-time 10 --retry 12 --retry-delay 5 --retry-all-errors \
  "https://${api_host:-api.carlab.rs}/health/ready"; then
  echo "Live at $tag."
else
  echo "The stack is up but the public health check failed." >&2
  [ ! -s .previous-tag ] || echo "Roll back with: $0 $(cat .previous-tag)" >&2
  exit 1
fi
