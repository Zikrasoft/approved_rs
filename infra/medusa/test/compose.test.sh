#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
printf 'POSTGRES_PASSWORD=x\nMEDUSA_TAG=%s\n' 0000000000000000000000000000000000000000 >"$work/.env"
docker compose -f "$here/docker-compose.yml" --project-directory "$work" config --format json >"$work/config.json"

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
expect 'postgres and redis sit on the internal network only' \
  '[.services.postgres, .services.redis | .networks | keys] == [["data"], ["data"]] and .networks.data.internal == true'
expect 'the edge network carries IPv6 so clients reach caddy without the userland proxy' \
  '.networks.edge.enable_ipv6 == true and ([.networks.edge.ipam.config[].subnet] | any(test(":")))'
expect 'every service restarts on its own' '[.services[] | .restart] | all(. == "unless-stopped")'
expect 'every service has a memory limit, together under 3.2 GB' \
  '[.services[] | .mem_limit | tonumber] | (all(. > 0) and add < 3200 * 1024 * 1024)'
expect 'every image is pinned to an exact tag' \
  '[.services[] | .image] | all(test(":([0-9]+\\.[0-9]+[.a-z0-9-]*|[0-9a-f]{40})$"))'

[ "$failures" -eq 0 ]
