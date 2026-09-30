#!/bin/sh
set -u

site=${SITE_URL:-https://carlab.rs}
body=$(mktemp)
trap 'rm -f "$body"' EXIT

if ! code=$(curl -sS -o "$body" -w '%{http_code}' --max-time 15 "$site/catalog-version.txt"); then
  echo "$site did not answer"
  exit 1
fi

case $code in
404)
  echo "the shop is not live on $site"
  exit 0
  ;;
200) ;;
*)
  echo "$site/catalog-version.txt answered $code"
  exit 1
  ;;
esac

baked=$(tr -d '[:space:]' <"$body")

if [ "$baked" = disabled ]; then
  echo "the shop is disabled on $site"
  exit 0
fi

if [ -z "${MEDUSA_URL:-}" ] || [ -z "${MEDUSA_PUBLISHABLE_KEY:-}" ]; then
  echo "MEDUSA_URL or MEDUSA_PUBLISHABLE_KEY is not set"
  exit 1
fi

if ! live=$(curl -fsS --max-time 15 \
  -H "x-publishable-api-key: $MEDUSA_PUBLISHABLE_KEY" \
  "$MEDUSA_URL/store/catalog-version" | jq -er '.version | strings'); then
  echo "$MEDUSA_URL/store/catalog-version did not give a version"
  exit 1
fi

if [ "$live" = unstamped ]; then
  echo "the store has never stamped its catalog"
  exit 1
fi

if [ "$live" = "$baked" ]; then
  echo "catalog $live is live"
  exit 0
fi

echo "the site has catalog $baked, the store is at $live"
exit 1
