#!/bin/sh
set -eu
umask 077
cd "$(dirname -- "$0")"

days=${1:-7}
case $days in
'' | *[!0-9]* | 0)
  echo "usage: $0 [days, default 7]" >&2
  exit 2
  ;;
esac

dest=${EXPORT_DIR:-exports}
network=${LOGS_NETWORK:-carlab_logs}
base="$dest/carlab-events-$(date -u +%Y-%m-%d)"
mkdir -p "$dest"
trap 'rm -f "$base.jsonl.part" "$base.summary.part"' EXIT
find "$dest" -maxdepth 1 -type f -name 'carlab-events-*' -mtime +56 -delete

docker run --rm --network "$network" grafana/logcli:3.7.9 query \
  --addr=http://loki:3100 --quiet --output=raw --forward \
  --since="$((days * 24))h" --limit=0 --batch=5000 \
  '{service="medusa", event=~".+"}' >"$base.jsonl.part"

{
  echo "CarLab shop events, the last $days days, exported $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "lines: $(wc -l <"$base.jsonl.part" | tr -d ' ')"
  echo
  echo "count event outcome"
  sed -nE 's/^\{"event":"([^"]*)"(.*"outcome":"([^"]*)")?.*/\1 \3/p' "$base.jsonl.part" |
    sort | uniq -c | sort -rn
} >"$base.summary.part"

gzip -c "$base.jsonl.part" >"$base.jsonl.gz"
mv "$base.summary.part" "$base.summary.txt"
echo "$base.jsonl.gz"
echo "$base.summary.txt"
