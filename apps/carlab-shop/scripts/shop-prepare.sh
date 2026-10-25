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
LEAD_ROUTE_URL=http://127.0.0.1:4321/api/leads
EOF
  echo "Created apps/carlab-shop/.env"
fi
sed -i.bak 's|^LEAD_ROUTE_URL=http://localhost:4321/|LEAD_ROUTE_URL=http://127.0.0.1:4321/|' .env && rm .env.bak

[ -f "$STOREFRONT_ENV" ] || cp ../auto-service/.env.example "$STOREFRONT_ENV"
for pair in TELEGRAM_BOT_TOKEN=1:fake TELEGRAM_BOT_USERNAME=demo_crm_bot \
  TELEGRAM_GROUP_ID=-1 TELEGRAM_OWNER_ID=1 TELEGRAM_ADMIN_ID=2 SHOP_OPEN=true; do
  key=${pair%%=*}
  if grep -q "^$key=$" "$STOREFRONT_ENV"; then
    sed -i.bak "s|^$key=\$|$pair|" "$STOREFRONT_ENV" && rm "$STOREFRONT_ENV.bak"
  elif ! grep -q "^$key=" "$STOREFRONT_ENV"; then
    echo "$pair" >> "$STOREFRONT_ENV"
  fi
done

for name in carlab-demo-pg carlab-demo-ts; do
  project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$name" 2>/dev/null || true)
  if docker inspect "$name" >/dev/null 2>&1 && [ "$project" != carlab-demo ]; then
    docker rm -f "$name" >/dev/null
    echo "Replaced the hand-started $name container"
  fi
done

docker compose -f docker-compose.demo.yml up -d --wait
if docker exec carlab-demo-pg psql -U postgres -d medusa -Atc \
  "select 1 from mikro_orm_migrations where name in ('Migration20261021101943', 'Migration20261023052422')" 2>/dev/null | grep -q 1; then
  echo "The demo database holds the shop's pre-squash migration history; recreating it"
  docker exec carlab-demo-pg psql -U postgres -q -c 'drop database medusa with (force)' -c 'create database medusa'
fi
pnpm db:migrate
pnpm seed:demo
pnpm publish:local
