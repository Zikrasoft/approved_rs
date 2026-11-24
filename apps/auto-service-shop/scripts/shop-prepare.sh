#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
SHOP=$(pwd)
STOREFRONT_ENV=../auto-service/.env.local
OVERRIDES="$SHOP/.local-demo/supplier-overrides.json"

mkdir -p "$(dirname "$OVERRIDES")"
[ -f "$OVERRIDES" ] || echo '{}' > "$OVERRIDES"

if [ ! -f .env ]; then
  cat > .env <<EOF
PORT=9009
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55444/medusa
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
STORE_CORS=http://localhost:4321
ADMIN_CORS=http://localhost:9009
AUTH_CORS=http://localhost:9009
TYPESENSE_HOST=127.0.0.1
TYPESENSE_PORT=58444
TYPESENSE_API_KEY=xyz
SUPPLIER_ADAPTERS=demo
DEMO_SUPPLIER_OVERRIDES=$OVERRIDES
STOREFRONT_ORIGIN=http://127.0.0.1:4321
EOF
  echo "Created apps/auto-service-shop/.env"
fi
sed -i.bak 's|^LEAD_ROUTE_URL=.*|STOREFRONT_ORIGIN=http://127.0.0.1:4321|' .env && rm .env.bak

fill() {
  file=$1
  shift
  [ -z "$(tail -c1 "$file")" ] || echo >> "$file"
  for pair in "$@"; do
    key=${pair%%=*}
    if grep -q "^$key=$" "$file"; then
      sed -i.bak "s|^$key=\$|$pair|" "$file" && rm "$file.bak"
    elif ! grep -q "^$key=" "$file"; then
      echo "$pair" >> "$file"
    fi
  done
}

fill .env S3_ENDPOINT=http://127.0.0.1:59444 S3_REGION=us-east-1 \
  S3_ACCESS_KEY_ID=carlab-demo S3_SECRET_ACCESS_KEY=carlab-demo-secret \
  S3_PUBLIC_BUCKET=carlab-public S3_PRIVATE_BUCKET=carlab-private \
  FILE_URL=http://127.0.0.1:59444/carlab-public

[ -f "$STOREFRONT_ENV" ] || cp ../auto-service/.env.example "$STOREFRONT_ENV"
fill "$STOREFRONT_ENV" TELEGRAM_BOT_TOKEN=1:fake TELEGRAM_BOT_USERNAME=demo_crm_bot \
  TELEGRAM_GROUP_ID=-1 TELEGRAM_OWNER_ID=1 TELEGRAM_ADMIN_ID=2 SHOP_OPEN=true

for name in carlab-demo-pg carlab-demo-ts carlab-demo-s3; do
  project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$name" 2>/dev/null || true)
  if docker inspect "$name" >/dev/null 2>&1 && [ "$project" != carlab-demo ]; then
    docker rm -f "$name" >/dev/null
    echo "Replaced the hand-started $name container"
  fi
done

docker compose -f docker-compose.demo.yml up -d --wait
if docker exec carlab-demo-pg psql -U postgres -d medusa -Atc \
  "select 1 from mikro_orm_migrations where name in ('Migration20261021101943', 'Migration20261023052422')
   or (name = 'Migration20261025010101' and to_regclass('crawl_run') is null)" 2>/dev/null | grep -q 1; then
  echo "The demo database holds the shop's pre-squash migration history; recreating it"
  docker exec carlab-demo-pg psql -U postgres -q -c 'drop database medusa with (force)' -c 'create database medusa'
fi
pnpm db:migrate
pnpm seed:demo
pnpm import:local
OPENAI_API_KEY= pnpm publish:local
