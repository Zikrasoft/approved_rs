#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
net=carlab-caddy-test-$$
trap 'docker rm -f "$net-medusa" "$net-site" "$net-caddy" >/dev/null 2>&1; docker network rm "$net" >/dev/null 2>&1; rm -rf "$work"' EXIT
printf 'POSTGRES_PASSWORD=x\nCRM_DB_PASSWORD=c0ffee\nTYPESENSE_API_KEY=y\nMEDUSA_TAG=%s\nADMIN_BASIC_AUTH_USER=staff\nADMIN_BASIC_AUTH_HASH=%s\nGRAFANA_ADMIN_PASSWORD=g\nMEDIA_ORIGIN=https://bucket.s3.eu-north-1.amazonaws.com\n' \
  0000000000000000000000000000000000000000 "'\$2a\$14\$hash'" >"$work/.env"
env -u MEDIA_ORIGIN -u POSTGRES_PASSWORD -u CRM_DB_PASSWORD -u TYPESENSE_API_KEY -u MEDUSA_TAG -u ADMIN_BASIC_AUTH_USER -u ADMIN_BASIC_AUTH_HASH -u GRAFANA_ADMIN_PASSWORD -u GRAFANA_PORT docker compose -f "$here/docker-compose.yml" --project-directory "$work" --profile "*" config --format json >"$work/config.json"
docker compose -f "$here/docker-compose.yml" --project-directory "$work" --profile "*" config --format json --no-env-resolution 2>/dev/null | jq .services >"$work/services.json"

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

expect 'only caddy publishes a port to the world' '[.services | to_entries[] | select(.value.ports) | .key] == ["caddy", "grafana"]'
expect 'grafana listens on the loopback only, for an ssh tunnel' \
  '.services.grafana.ports == [{"mode": "ingress", "host_ip": "127.0.0.1", "target": 3000, "published": "3000", "protocol": "tcp"}]'
expect 'the stack is the shop, the three sites, its logs and caddy, the crawler runs elsewhere' \
  '[.services | keys[]] == ["alloy", "caddy", "grafana", "loki", "medusa", "postgres", "site-approved-rs", "site-auto-service", "site-detailing", "typesense"]'
expect 'loki and alloy sit on the internal logs network only, grafana beside it' \
  '[.services.loki, .services.alloy, .services.grafana | .networks | keys] == [["logs"], ["logs"], ["console", "logs"]] and .networks.logs.internal == true'
expect 'alloy reads container logs from disk, read-only, with no docker socket' \
  '[.services.alloy.volumes[] | select(.type == "bind") | {source, read_only}] | (index({"source": "/var/lib/docker/containers", "read_only": true}) != null) and (map(.source) | index("/var/run/docker.sock") == null)'
expect 'grafana takes its admin password from .env' \
  '.services.grafana.environment.GF_SECURITY_ADMIN_PASSWORD == "g" and .services.grafana.environment.GF_AUTH_ANONYMOUS_ENABLED == "false"'
expect 'grafana provisions its datasource and dashboard read-only' \
  '[.services.grafana.volumes[] | select(.type == "bind") | [.target, .read_only]] == [["/etc/grafana/provisioning", true], ["/etc/grafana/dashboards", true]]'
expect 'loki, alloy and grafana keep their data on volumes' \
  '[.services.loki, .services.alloy, .services.grafana | .volumes[] | select(.type == "volume") | .source] == ["lokidata", "alloydata", "grafanadata"]'
expect "medusa logs no http lines, which carry the client's address and query" \
  '.services.medusa.environment.LOG_LEVEL == "info"'
expect 'every log line carries its compose service for alloy' \
  '[.services[] | .logging.options.labels] | all(. == "com.docker.compose.service")'
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
expect 'caddy serves media on its own host from the origin set in .env' \
  '.services.caddy.environment.MEDIA_HOST == "media.carlab.rs" and (.services.caddy.environment.MEDIA_ORIGIN | length > 0)'
expect 'caddy gets the admin basic_auth credentials from .env, a bcrypt hash kept literal' \
  '.services.caddy.environment.ADMIN_BASIC_AUTH_USER == "staff" and (.services.caddy.environment.ADMIN_BASIC_AUTH_HASH | test("^[$]{2}2a[$]{2}14[$]{2}hash$"))'
expect 'every service restarts on its own' '[.services[] | .restart] | all(. == "unless-stopped")'
expect 'every service has a memory limit, together under the 4 GB of the host' \
  '[.services[] | .mem_limit | tonumber] | (all(. > 0) and add < 4096 * 1024 * 1024)'
expect 'what runs without grafana stays under 3.75 GB' \
  '[.services[] | select(.profiles != ["grafana"]) | .mem_limit | tonumber] | add < 3840 * 1024 * 1024'
expect 'grafana runs only on demand' '.services.grafana.profiles == ["grafana"]'
sites=$(jq -r '.sites | keys[]' "$here/../../.github/scripts/site-env.json")
shop_node=$(sed -n 's/^FROM \(node:[^ ]*\).*/\1/p' "$here/Dockerfile" | tail -n 1)
for app in $sites; do
  expect "site-$app runs its running release on the shop's pinned node ($shop_node), not the one caddy serves" \
    ".services[\"site-$app\"] | .image == \"$shop_node\" and .command == [\"node\", \"/srv/sites/$app/running/server/entry.mjs\"]"
  expect "site-$app starts only once it has a release" ".services[\"site-$app\"].profiles == [\"site-$app\"]"
  expect "site-$app listens for caddy on 4321 with a heap inside its limit" \
    ".services[\"site-$app\"] | .environment.HOST == \"0.0.0.0\" and .environment.PORT == \"4321\" and .environment.NODE_OPTIONS == \"--max-old-space-size=112\" and .mem_limit == \"167772160\""
  expect "site-$app sits on the edge network and the data network, and reads the releases read-only" \
    ".services[\"site-$app\"] | (.networks | keys) == [\"data\", \"edge\"] and .volumes == [{\"type\": \"bind\", \"source\": \"/srv/sites\", \"target\": \"/srv/sites\", \"read_only\": true, \"bind\": {}}] and .user == \"node\" and .cap_drop == [\"ALL\"]"
  expect "site-$app reaches the crm database as the crm role with the host password" \
    ".services[\"site-$app\"].environment.CRM_DATABASE_URL == \"postgres://crm:c0ffee@postgres:5432/crm\""
  expect "site-$app starts only once postgres is healthy" \
    ".services[\"site-$app\"].depends_on.postgres.condition == \"service_healthy\""
  expect "site-$app reports healthy only once it answers /" \
    ".services[\"site-$app\"].healthcheck.test | join(\" \") | test(\"127.0.0.1:4321/\")"
  expect "site-$app runs node under an init that passes SIGTERM on, so background work drains" \
    ".services[\"site-$app\"].init == true"
  if jq -e ".[\"site-$app\"].env_file == [{\"path\": \"/srv/sites/$app/running/.env\", \"required\": false}]" "$work/services.json" >/dev/null; then
    echo "ok - site-$app reads the env of its running release, so a rollback takes its env along"
  else
    echo "not ok - site-$app reads the env of its running release, so a rollback takes its env along"
    failures=$((failures + 1))
  fi
done
expect 'site-auto-service reaches the shop over the internal network, keeping its site settings' \
  '.services["site-auto-service"].environment | .SHOP_INTERNAL_URL == "http://medusa:9000" and .PORT == "4321" and (.CRM_DATABASE_URL | length > 0)'
expect 'the other sites get no internal shop address' \
  '[.services["site-detailing", "site-approved-rs"].environment.SHOP_INTERNAL_URL] == [null, null]'
expect 'the shop answers on the data network the site shares, as medusa' \
  '(.services.medusa.networks | has("data")) and (.services["site-auto-service"].networks | has("data"))'
expect 'caddy reads the site releases read-only' \
  '[.services.caddy.volumes[] | select(.target == "/srv/sites") | [.source, .read_only]] == [["/srv/sites", true]]'
expect 'caddy serves the three sites on their own domains' \
  '.services.caddy.environment | .CARLAB_HOST == "carlab.rs" and .DETAILS_HOST == "details.rs" and .APPROVED_HOST == "approved.rs"'
expect 'every image is pinned to an exact tag' \
  '[.services[] | .image] | all(test(":(v?[0-9]+\\.[0-9]+[.a-z0-9-]*|[0-9a-f]{40})$"))'

caddy_image=$(jq -r .services.caddy.image "$work/config.json")
hash=$(docker run --rm "$caddy_image" caddy hash-password --plaintext staff-pass)
docker network create "$net" >/dev/null
docker run -d --name "$net-medusa" --network "$net" --network-alias medusa "$caddy_image" \
  caddy respond --listen :9000 '{http.request.body}' >/dev/null
docker run -d --name "$net-site" --network "$net" --network-alias site-auto-service --network-alias site-detailing \
  --network-alias site-approved-rs "$caddy_image" caddy respond --listen :4321 \
  -H 'X-Upstream: {http.request.host} {http.request.header.X-Forwarded-Proto} {http.request.header.X-Forwarded-For} {http.request.header.X-Request-Id}' node >/dev/null
for app in $sites; do
  mkdir -p "$work/sites/$app/releases/r/client/ru" "$work/sites/$app/releases/r/client/_astro"
  echo "$app ru" >"$work/sites/$app/releases/r/client/ru/index.html"
  echo "$app js" >"$work/sites/$app/releases/r/client/_astro/app.js"
  ln -s releases/r "$work/sites/$app/current"
done
docker run -d --name "$net-caddy" --network "$net" -p 127.0.0.1::443 \
  -e API_HOST=api.localhost -e ADMIN_HOST=admin.localhost \
  -e MEDIA_HOST=media.localhost -e MEDIA_ORIGIN=http://medusa:9000 \
  -e ADMIN_BASIC_AUTH_USER=staff -e ADMIN_BASIC_AUTH_HASH="$hash" \
  -e CARLAB_HOST=carlab.localhost -e DETAILS_HOST=details.localhost -e APPROVED_HOST=approved.localhost \
  -v "$work/sites:/srv/sites:ro" \
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
answers 'the media host serves an image' 200 media /supplier-images/x
answers 'the media host answers HEAD' 200 media /supplier-images/x -I
answers 'the media host refuses writes' 405 media /supplier-images/x -X PUT
cache=$(curl -sk -D - -o /dev/null --max-time 5 --resolve "media.localhost:$port:127.0.0.1" "https://media.localhost:$port/supplier-images/x" | tr -d '\r' | sed -n 's/^cache-control: //Ip')
if [ "$cache" = 'public, max-age=31536000, immutable' ]; then echo 'ok - the media host caches images for a year'; else echo "not ok - media cache-control ($cache)"; failures=$((failures + 1)); fi

fetch() {
  host=$1
  path=$2
  shift 2
  curl -sk -D "$work/headers" --max-time 5 --resolve "$host.localhost:$port:127.0.0.1" "$@" \
    "https://$host.localhost:$port$path" | tr -d '\r' || true
  tr -d '\r' <"$work/headers" >"$work/headers.clean"
}
serves() {
  name=$1
  want=$2
  shift 2
  got=$(fetch "$@")
  if [ "$got" = "$want" ]; then
    echo "ok - $name"
  else
    echo "not ok - $name (got '$got', want '$want')"
    failures=$((failures + 1))
  fi
}
header() {
  name=$1
  want=$2
  got=$(sed -n "s/^$3: //Ip" "$work/headers.clean")
  if [ "$got" = "$want" ]; then
    echo "ok - $name"
  else
    echo "not ok - $name (got '$got', want '$want')"
    failures=$((failures + 1))
  fi
}
node --experimental-strip-types --input-type=module -e "
import { SECURITY_HEADERS } from '$here/../../packages/site-kit/src/securityHeaders.ts';
for (const { key, value } of SECURITY_HEADERS) console.log(key + '\t' + value);
" >"$work/security-headers"
tab=$(printf '\t')
secured() {
  missing=0
  while IFS="$tab" read -r key value; do
    [ "$(sed -n "s/^$key: //Ip" "$work/headers.clean")" = "$value" ] || missing=$((missing + 1))
  done <"$work/security-headers"
  if [ "$missing" -eq 0 ] && [ -s "$work/security-headers" ] && ! grep -qi '^server:' "$work/headers.clean"; then
    echo "ok - $1"
  else
    echo "not ok - $1 ($missing security headers differ from site-kit, or Server is sent)"
    failures=$((failures + 1))
  fi
}

serves 'carlab.rs serves a prerendered page from its release' 'auto-service ru' carlab /ru/
header 'a prerendered page is revalidated on every visit' 'public, max-age=0, must-revalidate' cache-control
secured 'a prerendered page carries the site security headers'
serves 'a page without its trailing slash is served from the release too' 'auto-service ru' carlab /ru
serves 'details.rs serves its own release' 'detailing ru' details /ru/
serves 'approved.rs serves its own release' 'approved-rs ru' approved /ru/
serves 'a hashed asset is served from the release' 'auto-service js' carlab /_astro/app.js
header 'a hashed asset is cached for a year' 'public, max-age=31536000, immutable' cache-control
secured 'a static file carries the site security headers'
serves 'the site root goes to node for its locale redirect' node carlab /
secured 'a node response carries the site security headers'
header 'caddy adds no cache to a node response' '' cache-control
serves 'a path with no file goes to node' node carlab /ru/no-such-page/
serves 'an API route goes to node' node details /api/leads -X POST
upstream() {
  if grep -Eqi '^x-upstream: carlab.localhost https [0-9a-f.:]+ [0-9a-f-]{36}$' "$work/headers.clean" && ! grep -q 6.6.6.6 "$work/headers.clean"; then
    echo "ok - $1"
  else
    echo "not ok - $1 ($(grep -i '^x-upstream' "$work/headers.clean"))"
    failures=$((failures + 1))
  fi
}
fetch carlab /no-such-page >/dev/null
upstream 'a path no redirect names goes to node with the visitor host, https and a request id'
fetch carlab /no-such-page -H 'X-Forwarded-For: 6.6.6.6' >/dev/null
upstream 'a visitor cannot spoof the address node sees'
serves 'carlab.rs leaves an unprefixed section to node, whose middleware picks the locale' node carlab '/services/brakes?utm=x'
serves 'approved.rs leaves a legacy URL to node, whose middleware owns every redirect' node approved /cases/mercedes-c-2021-de/
status_of() {
  sed -n '1s/^HTTP[^ ]* \([0-9]*\).*/\1/p' "$work/headers.clean"
}
fetch carlab '/_image?href=/x.png' >/dev/null
if [ "$(status_of)" = 404 ]; then echo 'ok - the unused image endpoint is closed'; else echo "not ok - /_image answered $(status_of)"; failures=$((failures + 1)); fi
fetch www.carlab '/ru/?a=1' >/dev/null
header 'www.carlab.rs redirects to the apex' 'https://carlab.localhost/ru/?a=1' location
secured 'a www redirect carries the site security headers'
fetch www.details / >/dev/null
header 'www.details.rs redirects to the apex' 'https://details.localhost/' location
fetch www.approved / >/dev/null
header 'www.approved.rs redirects to the apex' 'https://approved.localhost/' location

[ "$failures" -eq 0 ]
