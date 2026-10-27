#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
printf 'POSTGRES_PASSWORD=x\nTYPESENSE_API_KEY=y\nMEDUSA_TAG=%s\n' 0000000000000000000000000000000000000000 >"$work/.env"
env -u POSTGRES_PASSWORD -u TYPESENSE_API_KEY -u MEDUSA_TAG docker compose -f "$here/docker-compose.yml" --project-directory "$work" config --format json >"$work/config.json"

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
expect 'the stack is medusa, its crawler, postgres, typesense and caddy' \
  '[.services | keys[]] == ["caddy", "crawler", "medusa", "postgres", "typesense"]'
expect 'the crawler runs the shop image as its own worker and reaches postgres by service name' \
  '.services.crawler.image == .services.medusa.image and .services.crawler.command == ["node", "src/lib/crawler/worker.js"] and .services.crawler.environment.DATABASE_URL == "postgres://carlab:x@postgres:5432/carlab"'
expect 'the crawler gets only the variables it reads, none of the shop secrets' \
  '(.services.crawler.env_file == null) and ([.services.crawler.environment | keys[]] == ["CRAWLER_FROM", "DATABASE_SSL", "DATABASE_URL", "NODE_ENV", "NODE_OPTIONS", "S3_ACCESS_KEY_ID", "S3_ENDPOINT", "S3_PRIVATE_BUCKET", "S3_PUBLIC_BUCKET", "S3_REGION", "S3_SECRET_ACCESS_KEY"])'
expect 'postgres and typesense sit on the internal network only' \
  '[.services.postgres, .services.typesense | .networks | keys] == [["data"], ["data"]] and .networks.data.internal == true'
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
expect 'every service restarts on its own' '[.services[] | .restart] | all(. == "unless-stopped")'
expect 'every service has a memory limit, together under 3.5 GB' \
  '[.services[] | .mem_limit | tonumber] | (all(. > 0) and add < 3500 * 1024 * 1024)'
expect 'every image is pinned to an exact tag' \
  '[.services[] | .image] | all(test(":([0-9]+\\.[0-9]+[.a-z0-9-]*|[0-9a-f]{40})$"))'

[ "$failures" -eq 0 ]
