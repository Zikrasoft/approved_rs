#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"
work=$(mktemp -d)
project=carlab-logs-test-$$
marker=$project-$(date +%s)
port=$((20000 + $$ % 10000))
cp -R "$here/docker-compose.yml" "$here/loki" "$here/alloy" "$here/grafana" "$here/logs-export.sh" "$work/"
printf 'POSTGRES_PASSWORD=x\nTYPESENSE_API_KEY=y\nMEDUSA_TAG=%s\nADMIN_BASIC_AUTH_USER=staff\nADMIN_BASIC_AUTH_HASH=h\nGRAFANA_ADMIN_PASSWORD=grafana-test-pass\nGRAFANA_PORT=%s\n' \
  0000000000000000000000000000000000000000 "$port" >"$work/.env"
compose() {
  docker compose -p "$project" -f "$work/docker-compose.yml" --project-directory "$work" "$@"
}
cleanup() {
  docker rm -f "$project-medusa" "$project-other" >/dev/null 2>&1 || true
  compose down -v >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

failures=0
expect() {
  name=$1
  shift
  if "$@"; then
    echo "ok - $name"
  else
    echo "not ok - $name"
    failures=$((failures + 1))
  fi
}
holds() {
  printf '%s\n' "$1" | grep -Eq "$2"
}
lacks() {
  ! printf '%s\n' "$1" | grep -Eq "$2"
}
answers() {
  printf '%s' "$1" | jq -e "$2" >/dev/null
}

loki_config=$(docker run --rm -v "$work/loki/config.yaml:/etc/loki/config.yaml:ro" grafana/loki:3.7.9 \
  -config.file=/etc/loki/config.yaml -print-config-stderr -verify-config 2>&1 >/dev/null)
alloy_config=$(cat "$work/alloy/config.alloy")
expect 'loki keeps 30 days' holds "$loki_config" '^  retention_period: 30d$'
expect 'loki deletes what is older through its compactor' holds "$loki_config" '^  retention_enabled: true$'
expect 'loki caps its ingestion rate' holds "$loki_config" '^  ingestion_rate_mb: 1$'
expect 'loki reports no usage home' holds "$loki_config" '^  reporting_enabled: false$'
expect 'the alloy config is valid' \
  docker run --rm -v "$work/alloy/config.alloy:/etc/alloy/config.alloy:ro" grafana/alloy:v1.21.3 validate /etc/alloy/config.alloy
expect 'alloy drops lines past 10 a second, which with the retention caps the disk' \
  holds "$(printf '%s\n' "$alloy_config" | grep -A3 'stage.limit {')" 'rate += 10'

compose up -d --quiet-pull loki alloy grafana >/dev/null 2>&1

emit() {
  name=$1
  service=$2
  shift 2
  docker run -d --name "$name" --label "com.docker.compose.service=$service" \
    --log-driver json-file --log-opt labels=com.docker.compose.service \
    alpine:3.20 sh -c 'for line in "$@"; do printf "%s\n" "$line"; done; sleep 600' sh "$@" >/dev/null
}
emit "$project-medusa" medusa \
  "{\"event\":\"search\",\"at\":\"x\",\"request_id\":\"$marker\",\"outcome\":\"empty\",\"intent\":\"text\",\"results\":0,\"zero\":true,\"query\":\"$marker\",\"category\":null,\"scoped\":false}" \
  "{\"event\":\"store.request\",\"at\":\"x\",\"request_id\":\"$marker\",\"outcome\":\"ok\",\"reason\":null,\"method\":\"GET\",\"route\":\"GET /store/search\",\"status\":200,\"duration_ms\":12,\"client\":\"abc\"}" \
  "{\"event\":\"vin.lookup\",\"at\":\"x\",\"request_id\":\"$marker\",\"outcome\":\"unresolved\",\"reason\":\"no_vehicle\",\"make\":\"bmw\",\"code\":\"99ZZ\",\"wmi\":\"WBA\",\"vin\":\"abc\",\"candidates\":0}" \
  "{\"event\":\"store.error\",\"at\":\"x\",\"request_id\":\"$marker\",\"outcome\":\"failed\",\"reason\":\"unexpected\",\"route\":\"GET /store/search\",\"status\":500,\"cause\":\"Error: boom\"}" \
  "{\"event\":\"storefront.csp\",\"at\":\"x\",\"request_id\":null,\"directive\":\"img-src\",\"blocked\":\"$marker.example\"}" \
  "{\"level\":\"http\",\"client_ip\":\"198.51.100.77\",\"path\":\"/store/search?q=$marker-http\"}" \
  "{\"level\":\"info\",\"message\":\"$marker medusa free text\"}"
emit "$project-other" caddy "{\"event\":\"search\",\"request_id\":\"$marker-other\",\"outcome\":\"empty\"}"

logcli() {
  docker run --rm --network "${project}_logs" grafana/logcli:3.7.9 "$@" --addr=http://loki:3100 --quiet
}
query() {
  logcli query --output=raw --since=1h --limit=0 "$1" 2>/dev/null
}
count() {
  query "$1" | grep -c . || true
}
tries=0
until [ "$(count '{service="medusa"} |= "'"$marker"' medusa free text"')" = 1 ] || [ "$tries" -ge 60 ]; do
  tries=$((tries + 1))
  sleep 2
done

events=$(query '{service="medusa", event=~".+"} |= "'"$marker"'"')
expect 'alloy ships the five events of the medusa service' [ "$(printf '%s\n' "$events" | grep -c .)" = 5 ]
expect 'each event keeps its own line, unwrapped from the docker log' holds "$events" '^\{"event":"search","at":"x"'
expect 'the event name is a label' [ "$(count '{service="medusa", event="vin.lookup"} |= "'"$marker"'"')" = 1 ]
expect "medusa's free text reaches loki without an event label" \
  [ "$(count '{service="medusa", event=""} |= "'"$marker"' medusa free text"')" = 1 ]
expect "morgan's http line, with its address, never reaches loki" [ "$(count '{service=~".+"} |= "'"$marker"'-http"')" = 0 ]
expect 'another service never reaches loki' [ "$(count '{service=~".+"} |= "'"$marker"'-other"')" = 0 ]
expect 'no per-container label reaches loki' lacks "$(logcli labels 2>/dev/null)" '^filename$'

jq -r '.panels[].targets[].expr' "$here/grafana/dashboards/carlab.json" |
  sed -e 's/[$]__auto/5m/g' -e 's/[$]__range/1h/g' >"$work/panel-queries"
bad=0
while IFS= read -r expr; do
  logcli query --since=1h --limit=10 "$expr" >/dev/null 2>"$work/query-error" || {
    echo "# $expr"
    sed 's/^/#   /' "$work/query-error"
    bad=$((bad + 1))
  }
done <"$work/panel-queries"
expect 'every dashboard query runs on loki' [ "$bad" = 0 ]

mkdir "$work/exports"
EXPORT_DIR="$work/exports" LOGS_NETWORK="${project}_logs" sh "$work/logs-export.sh" 1 >"$work/export.out"
day=$(date -u +%Y-%m-%d)
exported=$(gunzip -c "$work/exports/carlab-events-$day.jsonl.gz")
summary=$(cat "$work/exports/carlab-events-$day.summary.txt")
expect 'the export holds the five events' [ "$(printf '%s\n' "$exported" | grep -c "$marker")" = 5 ]
expect 'the export holds event lines only' lacks "$exported" '^[^{]|^\{"[^e]'
expect 'the export holds no free text and no address' lacks "$exported" 'free text|198\.51\.100\.77'
expect 'the export names the files it wrote' holds "$(cat "$work/export.out")" "carlab-events-$day\\.summary\\.txt$"
expect 'the summary counts events by outcome' holds "$summary" '^ +[0-9]+ vin\.lookup unresolved$'
expect 'the summary counts an event without an outcome' holds "$summary" '^ +[0-9]+ storefront\.csp $'
expect 'the export leaves no partial file behind' [ -z "$(find "$work/exports" -name '*.part')" ]
if EXPORT_DIR="$work/exports" sh "$work/logs-export.sh" seven 2>/dev/null; then refused=no; else refused=yes; fi
expect 'the export refuses a day count that is not a number' [ "$refused" = yes ]
mkdir "$work/unreachable"
if EXPORT_DIR="$work/unreachable" LOGS_NETWORK="$project-no-such-network" sh "$work/logs-export.sh" >/dev/null 2>&1; then
  failed=no
else
  failed=yes
fi
expect 'the export fails when loki cannot be read' [ "$failed" = yes ]
expect 'a failed export leaves no file behind' [ -z "$(find "$work/unreachable" -type f)" ]

grafana() {
  curl -s --max-time 5 -u "admin:$1" "http://127.0.0.1:$port$2" || true
}
tries=0
until answers "$(grafana grafana-test-pass /api/health)" '.database == "ok"' || [ "$tries" -ge 30 ]; do
  tries=$((tries + 1))
  sleep 2
done
expect 'grafana answers on the loopback' answers "$(grafana grafana-test-pass /api/health)" '.database == "ok"'
expect 'grafana refuses a wrong admin password' \
  [ "$(curl -s -o /dev/null -w '%{http_code}' -u admin:wrong "http://127.0.0.1:$port/api/datasources")" = 401 ]
expect 'grafana provisions the Loki datasource' \
  answers "$(grafana grafana-test-pass /api/datasources)" '.[] | select(.uid == "loki" and .url == "http://loki:3100")'
expect 'grafana provisions the shop dashboard' \
  answers "$(grafana grafana-test-pass /api/dashboards/uid/carlab-shop)" '.dashboard.title == "CarLab shop"'
expect 'grafana reaches loki through the datasource' \
  answers "$(grafana grafana-test-pass /api/datasources/uid/loki/health)" '.status == "OK"'

compose ps -q | xargs docker stats --no-stream --format '# {{.Name}} {{.MemUsage}}' || true

[ "$failures" -eq 0 ]
