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

crm_password=$(sed -n 's/^CRM_DB_PASSWORD=//p' .env)
[ -n "$crm_password" ] || {
  echo "CRM_DB_PASSWORD is not set in .env: the sites keep their Leads in the crm database. Set it (openssl rand -hex 32) and deploy again." >&2
  exit 1
}

mkdir .deploy.lock 2>/dev/null || {
  echo "A deploy or backup is already running (.deploy.lock present)." >&2
  exit 1
}
trap 'rmdir .deploy.lock 2>/dev/null || true' EXIT

previous=$(sed -n 's/^MEDUSA_TAG=//p' .env)
api_host=$(sed -n 's/^API_HOST=//p' .env)
image=$(sed -n 's/^MEDUSA_IMAGE=//p' .env)
image=${image:-ghcr.io/zikrasoft/podbor-auto-service-shop}
export MEDUSA_TAG="$tag"
caddy_tag=$(cat caddy-tag 2>/dev/null || true)
unset CADDY_TAG
[ -z "$caddy_tag" ] || export CADDY_TAG="$caddy_tag"

echo "==> Image $tag"
docker compose pull --policy missing medusa caddy

backups=${BACKUP_DIR:-/var/backups/carlab}
dump="$backups/db-$(date -u +%Y-%m-%dT%H-%M-%SZ)-pre-deploy.dump"
echo "==> Backup to $dump"
mkdir -p "$backups"
docker compose up -d --wait postgres
docker compose exec -T postgres \
  psql -U carlab -d carlab -v ON_ERROR_STOP=1 -c 'create extension if not exists pg_stat_statements'
docker compose exec -T postgres \
  pg_dump -U carlab -d carlab --format=custom >"$dump.part"
mv "$dump.part" "$dump"
find "$backups" -maxdepth 1 -type f -name 'db-*-pre-deploy.dump' | sort -r | tail -n +4 | while read -r old; do
  rm -f "$old"
done

echo "==> Migrations"
docker compose run --rm -T medusa \
  node_modules/.bin/medusa db:migrate --execute-safe-links --all-or-nothing

echo "==> Schema check"
docker compose run --rm -T medusa \
  node_modules/.bin/medusa exec ./src/scripts/check-schema.js

echo "==> Production seed"
docker compose run --rm -T medusa \
  node_modules/.bin/medusa exec ./src/scripts/seed-production.js

./crawler-role.sh
./crm-role.sh

echo "==> CRM migrations"
CRM_DATABASE_URL="postgres://crm:$crm_password@postgres:5432/crm" CHECKPOINT_DISABLE=1 \
  docker compose run --rm -T -e CRM_DATABASE_URL -e CHECKPOINT_DISABLE \
  -w /server/node_modules/@podbor/lead-crm medusa node_modules/.bin/prisma migrate deploy

grep -v -e '^MEDUSA_TAG=' -e '^CADDY_TAG=' .env >.env.next
echo "MEDUSA_TAG=$tag" >>.env.next
[ -z "$caddy_tag" ] || echo "CADDY_TAG=$caddy_tag" >>.env.next
mv .env.next .env
if [ -n "$previous" ] && [ "$previous" != "$tag" ]; then
  echo "$previous" >.previous-tag
fi
trap '[ $? -eq 0 ] || [ ! -s .previous-tag ] || echo "Roll back with: $0 $(cat .previous-tag)" >&2; rmdir .deploy.lock 2>/dev/null || true' EXIT

sites=${SITES_ROOT:-/srv/sites}
[ -d "$sites" ] || sudo install -d -m 0755 -o "$(id -u)" -g "$(id -g)" "$sites"
COMPOSE_PROFILES=
for site in "$sites"/*; do
  [ -L "$site/current" ] || continue
  [ -L "$site/running" ] || ln -s "$(readlink "$site/current")" "$site/running"
  COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}site-${site##*/}"
done
export COMPOSE_PROFILES

echo "==> Restarting"
docker compose up -d --wait --wait-timeout 300 --remove-orphans
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "==> https://${api_host:-api.carlab.rs}/health/ready"
if curl -fsS -o /dev/null --max-time 10 --retry 12 --retry-delay 5 --retry-all-errors \
  "https://${api_host:-api.carlab.rs}/health/ready"; then
  echo "Live at $tag."
  keep=$(cat .previous-tag 2>/dev/null || echo "$tag")
  for repo in "$image" ghcr.io/zikrasoft/podbor-carlab-caddy; do
    docker image ls "$repo" --format '{{.Tag}}' | grep -vx -e "$tag" -e "$keep" -e "$caddy_tag" -e '<none>' -e '' | while read -r old; do
      docker image rm "$repo:$old" >/dev/null || echo "Could not remove $repo:$old." >&2
    done || true
  done
else
  echo "The stack is up but the public health check failed." >&2
  exit 1
fi
