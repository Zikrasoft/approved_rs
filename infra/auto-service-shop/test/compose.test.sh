#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
net=carlab-caddy-test-$$
trap 'docker rm -f "$net-medusa" "$net-caddy" >/dev/null 2>&1; docker network rm "$net" >/dev/null 2>&1; rm -rf "$work"' EXIT
printf 'POSTGRES_PASSWORD=x\nTYPESENSE_API_KEY=y\nMEDUSA_TAG=%s\nADMIN_BASIC_AUTH_USER=staff\nADMIN_BASIC_AUTH_HASH=%s\n' \
  0000000000000000000000000000000000000000 "'\$2a\$14\$hash'" >"$work/.env"
env -u POSTGRES_PASSWORD -u TYPESENSE_API_KEY -u MEDUSA_TAG -u ADMIN_BASIC_AUTH_USER -u ADMIN_BASIC_AUTH_HASH docker compose -f "$here/docker-compose.yml" --project-directory "$work" config --format json >"$work/config.json"

failures=0
expect() {
  name=$1
  shift
  if jq -e "$@" "$work/config.json" >/dev/null; then
    echo "ok - $name"
  else
    echo "not ok - $name"
    failures=$((failures + 1))
  fi
}

expect 'only caddy publishes a port' '[.services | to_entries[] | select(.value.ports) | .key] == ["caddy"]'
expect 'the stack is medusa, postgres, typesense and caddy, the crawler runs elsewhere' \
  '[.services | keys[]] == ["caddy", "medusa", "postgres", "typesense"]'
expect 'postgres and typesense sit on the internal network only' \
  '[.services.postgres, .services.typesense | .networks | keys] == [["data"], ["data"]] and .networks.data.internal == true'
pg_address=$(sed -n "s/^POSTGRES_ADDRESS=\\(.*\\):5432\$/\\1/p" "$here/harden-ssh.sh")
expect "postgres keeps the fixed address the crawler tunnel may open ($pg_address)" \
  ".services.postgres.networks.data.ipv4_address == \"$pg_address\" and .networks.data.ipam.config == [{\"subnet\": \"10.200.0.0/24\", \"ip_range\": \"10.200.0.128/25\"}]"
expect 'medusa reaches typesense by service name with the shared key' \
  '.services.medusa.environment.TYPESENSE_HOST == "typesense" and .services.medusa.environment.TYPESENSE_API_KEY == "y" and .services.typesense.environment.TYPESENSE_API_KEY == "y"'
expect 'medusa reaches postgres by service name' \
  '.services.medusa.environment.DATABASE_URL == "postgres://carlab:x@postgres:5432/carlab"'
expect 'typesense keeps its index on a volume' \
  '[.services.typesense.volumes[] | .target] == ["/data"]'
expect 'the edge network carries IPv6 so clients reach caddy without the userland proxy' \
  '.networks.edge.enable_ipv6 == true and ([.networks.edge.ipam.config[].subnet] | any(test(":")))'
expect 'no service keeps shop files on a host volume, they live on S3' \
  '(.services.medusa.volumes == null) and ([.services.caddy.volumes[] | .target] | index("/srv/static") == null) and (.volumes | has("static") | not)'
expect 'caddy serves the admin on its own host' \
  '.services.caddy.environment.ADMIN_HOST == "admin.carlab.rs"'
expect 'caddy gets the admin basic_auth credentials from .env, a bcrypt hash kept literal' \
  '.services.caddy.environment.ADMIN_BASIC_AUTH_USER == "staff" and (.services.caddy.environment.ADMIN_BASIC_AUTH_HASH | test("^[$]{2}2a[$]{2}14[$]{2}hash$"))'
expect 'every service restarts on its own' '[.services[] | .restart] | all(. == "unless-stopped")'
expect 'every service has a memory limit, together under 3 GB' \
  '[.services[] | .mem_limit | tonumber] | (all(. > 0) and add < 3072 * 1024 * 1024)'
expect 'every image is pinned to an exact tag' \
  '[.services[] | .image] | all(test(":([0-9]+\\.[0-9]+[.a-z0-9-]*|[0-9a-f]{40})$"))'

caddy_image=$(jq -r .services.caddy.image "$work/config.json")
hash=$(docker run --rm "$caddy_image" caddy hash-password --plaintext staff-pass)
docker network create "$net" >/dev/null
docker run -d --name "$net-medusa" --network "$net" --network-alias medusa "$caddy_image" \
  caddy respond --listen :9000 '{http.request.body}' >/dev/null
docker run -d --name "$net-caddy" --network "$net" -p 127.0.0.1::443 \
  -e API_HOST=api.localhost -e ADMIN_HOST=admin.localhost \
  -e ADMIN_BASIC_AUTH_USER=staff -e ADMIN_BASIC_AUTH_HASH="$hash" \
  -v "$here/caddy:/etc/caddy:ro" "$caddy_image" >/dev/null
port=$(docker port "$net-caddy" 443/tcp | sed -n '1s/.*://p')

status() {
  host=$1
  path=$2
  shift 2
  curl -sk -o /dev/null -w '%{http_code}' --max-time 5 --resolve "$host.localhost:$port:127.0.0.1" "$@" \
    "https://$host.localhost:$port$path" || true
}
tries=0
until [ "$(status api /health)" = 200 ] || [ "$tries" -ge 30 ]; do
  tries=$((tries + 1))
  sleep 1
done

answers() {
  name=$1
  want=$2
  shift 2
  got=$(status "$@")
  if [ "$got" = "$want" ]; then
    echo "ok - $name"
  else
    echo "not ok - $name (got $got, want $want)"
    failures=$((failures + 1))
  fi
}

answers 'the API host serves the store' 200 api /store/products
answers 'the API host serves customer auth' 200 api /auth/customer/emailpass -X POST
answers 'the API host closes /admin' 404 api /admin
answers 'the API host closes the admin API' 404 api /admin/users
answers 'the API host closes staff login' 404 api /auth/user/emailpass -X POST
answers 'the API host closes staff login with a bearer token too' 404 api /auth/user/emailpass -X POST -H 'Authorization: Bearer x'
answers 'the API host closes the payment webhooks' 404 api /hooks/payment/stripe_stripe -X POST
answers 'the API host still serves the shop hooks' 200 api /hooks/carlab-orders/x/outcome -X POST
head -c 2000000 /dev/zero >"$work/big"
answers 'the API host refuses a body over 1 MB' 413 api /store/carts -X POST --data-binary "@$work/big"
answers 'the admin host takes a large upload' 200 admin /admin/uploads -u staff:staff-pass -X POST --data-binary "@$work/big"
answers 'the API host sends /app to the admin host' 302 api /app
answers 'the admin host asks for basic_auth' 401 admin /app
answers 'the admin host refuses a wrong password' 401 admin /app -u staff:wrong
answers 'the admin host serves the admin with the password' 200 admin /app -u staff:staff-pass
answers 'staff login needs basic_auth even with a bearer token' 401 admin /auth/user/emailpass -X POST -H 'Authorization: Bearer x'
answers 'the admin API needs basic_auth even with a bearer token' 401 admin /admin/users -H 'Authorization: Bearer x'
answers 'the session exchange passes with a bearer token alone' 200 admin /auth/session -X POST -H 'Authorization: Bearer x'
answers 'an invite is accepted with a bearer token alone' 200 admin /admin/invites/accept -X POST -H 'Authorization: Bearer x'
answers 'a password reset is set with a bearer token alone' 200 admin /auth/user/emailpass/update -X POST -H 'Authorization: Bearer x'
answers 'the session exchange without a token needs basic_auth' 401 admin /auth/session -X POST

[ "$failures" -eq 0 ]
