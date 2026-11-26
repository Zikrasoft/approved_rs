#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
net=carlab-caddy-test-$$
preview_token=preview-$$-0123456789abcdef0123456789
trap 'docker rm -f "$net-medusa" "$net-site" "$net-caddy" >/dev/null 2>&1; docker network rm "$net" >/dev/null 2>&1; docker volume rm "$net-cache" >/dev/null 2>&1; rm -rf "$work"' EXIT
printf 'POSTGRES_PASSWORD=x\nCRM_DB_PASSWORD=c0ffee\nTYPESENSE_API_KEY=y\nMEDUSA_TAG=%s\nGRAFANA_ADMIN_PASSWORD=g\nMEDIA_ORIGIN=https://bucket.s3.eu-north-1.amazonaws.com\nSHOP_PREVIEW_TOKEN=%s\n' \
  0000000000000000000000000000000000000000 "$preview_token" >"$work/.env"
env -u MEDIA_ORIGIN -u POSTGRES_PASSWORD -u CRM_DB_PASSWORD -u TYPESENSE_API_KEY -u MEDUSA_TAG -u CADDY_TAG -u SHOP_PREVIEW_TOKEN -u GRAFANA_ADMIN_PASSWORD -u GRAFANA_PORT docker compose -f "$here/docker-compose.yml" --project-directory "$work" --profile "*" config --format json >"$work/config.json"
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
expect 'postgres runs jit off, tuned for the droplet, with pg_stat_statements and a slow-query log, shared_buffers left at its default' \
  '.services.postgres.command == ["postgres", "-c", "jit=off", "-c", "work_mem=8MB", "-c", "random_page_cost=1.1", "-c", "shared_preload_libraries=pg_stat_statements", "-c", "log_min_duration_statement=1000"]'
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
expect 'caddy serves the CRM bot webhooks on a host of their own' \
  '.services.caddy.environment.CRM_HOST == "crm.carlab.rs"'
expect 'caddy pulls the page cache image CI built for the same commit as medusa, inside its 128 MB' \
  '.services.caddy | .image == "ghcr.io/zikrasoft/podbor-carlab-caddy:0000000000000000000000000000000000000000" and .build == null and .mem_limit == "134217728"'
expect 'caddy takes the preview token from .env to verify the preview cookie' \
  ".services.caddy.environment.SHOP_PREVIEW_TOKEN == \"$preview_token\""
expect 'the caddy image tag falls back to the shop tag unless CADDY_TAG names its own content tag' \
  '.services.caddy.image | endswith(":0000000000000000000000000000000000000000")'
caddy_tag=$(CADDY_TAG=1111111111111111111111111111111111111111 env -u MEDUSA_TAG docker compose -f "$here/docker-compose.yml" --project-directory "$work" --profile "*" config --format json 2>/dev/null | jq -r .services.caddy.image)
if [ "$caddy_tag" = ghcr.io/zikrasoft/podbor-carlab-caddy:1111111111111111111111111111111111111111 ]; then echo 'ok - CADDY_TAG overrides the caddy image tag alone'; else echo "not ok - CADDY_TAG ($caddy_tag)"; failures=$((failures + 1)); fi
expect 'medusa reaches the cache purge listener by service name' \
  '.services.medusa.environment.CACHE_PURGE_URL == "http://caddy:2020/souin-api/souin"'
expect 'the cache purge listener publishes no host port' \
  '[.services.caddy.ports[].target] | index(2020) == null'
expect 'caddy keeps its page cache on a volume' \
  '[.services.caddy.volumes[] | select(.target == "/cache") | [.type, .source]] == [["volume", "caddycache"]]'
expect 'every image is pinned to an exact tag' \
  '[.services[] | .image] | all(test(":(v?[0-9]+\\.[0-9]+[.a-z0-9-]*|[0-9a-f]{40})$"))'

caddy_image=$(jq -r .services.caddy.image "$work/config.json")
docker build -q -t "$caddy_image" "$here/caddy-image" >/dev/null
mkdir "$work/stub"
cat >"$work/stub/Caddyfile" <<'STUB'
:4321 {
	header X-Upstream "{http.request.host} {http.request.header.X-Forwarded-Proto} {http.request.header.X-Forwarded-For} {http.request.header.X-Request-Id}"
	@private path /ru/parts/p/private/
	@public {
		path /ru/parts/* /ru/cars/* /sr/parts/* /llms.txt /sr/llms.txt /catalogue-build.json /sitemap-catalogue*
		not path /ru/parts/p/private/
	}
	header @private Cache-Control "private, no-store"
	header @public Cache-Control "public, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400"
	respond node
}
STUB
docker network create "$net" >/dev/null
docker run -d --name "$net-medusa" --network "$net" --network-alias medusa "$caddy_image" \
  caddy respond --listen :9000 '{http.request.body}' >/dev/null
docker run -d --name "$net-site" --network "$net" --network-alias site-auto-service --network-alias site-detailing \
  --network-alias site-approved-rs -v "$work/stub:/etc/caddy:ro" "$caddy_image" >/dev/null
for app in $sites; do
  mkdir -p "$work/sites/$app/releases/r/client/ru" "$work/sites/$app/releases/r/client/_astro"
  echo "$app ru" >"$work/sites/$app/releases/r/client/ru/index.html"
  echo "$app js" >"$work/sites/$app/releases/r/client/_astro/app.js"
  ln -s releases/r "$work/sites/$app/current"
done
docker run -d --name "$net-caddy" --network "$net" -p 127.0.0.1::443 \
  --memory 128m --cap-drop ALL --cap-add NET_BIND_SERVICE --security-opt no-new-privileges:true -v "$net-cache:/cache" \
  -e API_HOST=api.localhost -e ADMIN_HOST=admin.localhost \
  -e MEDIA_HOST=media.localhost -e MEDIA_ORIGIN=http://medusa:9000 -e SHOP_PREVIEW_TOKEN="$preview_token" \
  -e CARLAB_HOST=carlab.localhost -e DETAILS_HOST=details.localhost -e APPROVED_HOST=approved.localhost -e CRM_HOST=crm.localhost \
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
answers 'the admin host takes a large upload' 200 admin /admin/uploads -X POST --data-binary "@$work/big"
answers 'the API host sends /app to the admin host' 302 api /app
answers 'the admin host serves the admin without basic_auth' 200 admin /app
answers 'the admin host serves staff login' 200 admin /auth/user/emailpass -X POST
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
serves 'the CRM host passes the CRM bot webhook to carlab.rs node' node crm /api/telegram-webhook -X POST
serves 'the CRM host passes the approved.rs capture bot webhook to node' node crm /api/telegram-capture -X POST
answers 'the CRM host closes the lead form route' 404 crm /api/leads -X POST
answers 'the CRM host serves no pages' 404 crm /ru/
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

cache_status() {
  fetch "$@" >/dev/null
  sed -n 's/^cache-status: //Ip' "$work/headers.clean"
}
cached() {
  name=$1
  want=$2
  shift 2
  got=$(cache_status "$@")
  if printf '%s\n' "$got" | grep -Eq "$want"; then
    echo "ok - $name"
  else
    echo "not ok - $name (cache-status '$got', want /$want/)"
    failures=$((failures + 1))
  fi
}
purge=$(sed -n 's/.*docker compose exec -T caddy \(curl .*flush\);.*/\1/p' "$here/deploy-site.sh")
cached 'a first catalogue request goes to node and is stored' 'fwd=uri-miss; stored' carlab /ru/parts/p/a/
cached 'a second catalogue request is a hit' '; hit;' carlab /ru/parts/p/a/
cached 'an ad click shares the bare path entry' '; hit;' carlab '/ru/parts/p/a/?utm_source=x&gclid=y'
cached 'a visitor cannot force a render past the cache' '; hit;' carlab /ru/parts/p/a/ -H 'Cache-Control: no-cache' -H 'Pragma: no-cache'
cached 'a /cars page is cached too' 'fwd=uri-miss; stored' carlab /ru/cars/bmw/
cached 'the preview cookie holding the token bypasses the cache' '^$' carlab /ru/parts/p/a/ -H "Cookie: lang=ru; auto_service_shop_preview=$preview_token; theme=dark"
cached 'a junk preview cookie stays on the cache' '; hit;' carlab /ru/parts/p/a/ -H 'Cookie: auto_service_shop_preview=junk'
cached 'an empty preview cookie stays on the cache' '; hit;' carlab /ru/parts/p/a/ -H 'Cookie: auto_service_shop_preview='
cached 'a cookie that only starts with the token stays on the cache' '; hit;' carlab /ru/parts/p/a/ -H "Cookie: auto_service_shop_preview=${preview_token}x"
cached 'the preview flag cookie alone does not' '; hit;' carlab /ru/parts/p/a/ -H 'Cookie: auto_service_shop_preview_on=1'
cache_status carlab /ru/parts/p/private/ >/dev/null
cached 'a private, no-store response is never stored' 'fwd=uri-miss; detail=NO-STORE-DIRECTIVE' carlab /ru/parts/p/private/
for path in /llms.txt /sr/llms.txt /catalogue-build.json /sitemap-catalogue.xml /sitemap-catalogue-0.xml /ru/parts/; do
  cached "$path is cached like a catalogue page" 'fwd=uri-miss; stored' carlab "$path"
done
cached 'a browsed /parts/ hub stays out of the cache' '^$' carlab '/ru/parts/?offset=12'
for path in /ru/parts/search/ /ru/parts/cart/ /ru/parts/prices/ /ru/services/ /ru/ /sitemap-index.xml; do
  cached "$path stays out of the cache" '^$' carlab "$path"
done
cached 'details.rs has no page cache' '^$' details /ru/parts/p/a/
cached 'approved.rs has no page cache' '^$' approved /ru/cars/bmw/
serves 'a purge on the public host goes to node, not to the cache' node carlab /souin-api/souin/flush -X PURGE
serves 'a purge hidden in a catalogue query goes to node' node carlab '/ru/parts/p/a/?x=/souin-api/souin/flush' -X PURGE
serves 'the public host lists no cache keys' node carlab '/ru/parts/p/a/?x=/souin-api/souin'
cached 'a purge from outside the docker network leaves the cache alone' '; hit;' carlab /ru/parts/p/a/
if [ -n "$purge" ] && docker exec "$net-caddy" sh -c "$purge" >/dev/null; then echo "ok - deploy-site.sh's purge runs inside caddy"; else echo "not ok - deploy-site.sh's purge ($purge)"; failures=$((failures + 1)); fi
cached 'after the purge the next request is a miss' 'fwd=uri-miss; stored' carlab /ru/parts/p/a/
surrogates=$(docker exec "$net-caddy" curl -fsS http://127.0.0.1:2019/souin-api/souin/surrogate_keys)
if [ "$surrogates" = '{}' ] || [ "$surrogates" = null ]; then echo 'ok - the cache keeps no surrogate-key index, which grew with every page it stored'; else echo "not ok - surrogate keys are stored ($surrogates)"; failures=$((failures + 1)); fi
listener() {
  docker exec "$net-medusa" curl -sg -o /dev/null -w '%{http_code}' --max-time 5 "$@" || true
}
refuses() {
  got=$(listener "$@")
  if [ "$got" = 403 ]; then echo "ok - the purge listener refuses $*"; else echo "not ok - the purge listener answered $got to $*"; failures=$((failures + 1)); fi
}
purge_listener=http://$net-caddy:2020/souin-api/souin
warm() {
  for path in /ru/cars/bmw/ /ru/cars/audi/ /ru/parts/c/brakes/ /ru/parts/peugeot/3008/ /ru/parts/ /llms.txt /sr/llms.txt /catalogue-build.json /sitemap-catalogue.xml /sitemap-catalogue-0.xml /sr/parts/p/a/; do cache_status carlab "$path" >/dev/null; done
}
warm
refuses -X PURGE "$purge_listener/flush"
refuses -X PURGE "$purge_listener/mapping"
refuses "$purge_listener/"
refuses -X DELETE "$purge_listener/.+"
refuses -X PURGE "$purge_listener/"
refuses -X PURGE "$purge_listener/.+"
refuses -X PURGE "$purge_listener/.*"
refuses -X PURGE "$purge_listener/-/.*"
refuses -X PURGE "http://$net-caddy:2020/config/"
cached 'a refused flush leaves the cache alone' '; hit;' carlab /ru/cars/bmw/
node --experimental-strip-types --input-type=module -e "
import { CATALOGUE_HUB_PATTERNS, partPagePattern } from '$here/../../apps/auto-service-shop/src/lib/publish/purge.ts';
console.log(CATALOGUE_HUB_PATTERNS.join('\n'));
console.log(partPagePattern('a'));
" >"$work/purge-patterns"
hub_status=$(sed '$d' "$work/purge-patterns" | while read -r pattern; do listener -X PURGE "$purge_listener/$pattern"; echo; done | sort -u)
if [ "$hub_status" = 204 ]; then echo "ok - the shop's hub purges pass the listener"; else echo "not ok - the hub purges answered $hub_status"; failures=$((failures + 1)); fi
for path in /ru/cars/bmw/ /ru/cars/audi/ /ru/parts/c/brakes/ /ru/parts/peugeot/3008/ /ru/parts/ /llms.txt /sr/llms.txt /catalogue-build.json /sitemap-catalogue.xml /sitemap-catalogue-0.xml; do
  cached "the hub purge empties $path" 'fwd=uri-miss; stored' carlab "$path"
done
cached 'the hub purge keeps the Part pages' '; hit;' carlab /sr/parts/p/a/
listener -X PURGE "$purge_listener/$(tail -n 1 "$work/purge-patterns")" >/dev/null
cached "the Part page purge empties it in any locale" 'fwd=uri-miss; stored' carlab /sr/parts/p/a/
cached 'the Part page purge leaves the hubs' '; hit;' carlab /ru/cars/bmw/
docker exec "$net-caddy" sh -c 'echo stale >/cache/leftover'
docker restart "$net-caddy" >/dev/null
port=$(docker port "$net-caddy" 443/tcp | sed -n '1s/.*://p')
tries=0
until [ "$(status api /health)" = 200 ] || [ "$tries" -ge 30 ]; do
  tries=$((tries + 1))
  sleep 1
done
leftover=$(docker exec "$net-caddy" sh -c 'find /cache -mindepth 1 ! -name .simplefs-index | wc -l' | tr -d ' ')
if [ "$leftover" = 0 ]; then echo 'ok - a restart empties the cache volume, so its disk stays bounded'; else echo "not ok - $leftover files stay on the cache volume after a restart"; failures=$((failures + 1)); fi
cached 'after the restart the cache starts cold' 'fwd=uri-miss; stored' carlab /ru/parts/p/a/
docker stop "$net-site" >/dev/null
cached 'a stopped upstream still gets the cached page' '; hit;' carlab /ru/parts/p/a/
serves 'the cached page answers while node is down' node carlab /ru/parts/p/a/
answers 'an uncached page fails while node is down' 502 carlab /ru/parts/p/b/

[ "$failures" -eq 0 ]
