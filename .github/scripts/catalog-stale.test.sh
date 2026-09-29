#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/catalog-stale.sh"
bin=$(mktemp -d)
trap 'rm -rf "$bin"' EXIT

cat >"$bin/curl" <<'STUB'
#!/bin/sh
out=''
header=''
while [ "$#" -gt 1 ]; do
  case $1 in
  -o) out=$2; shift ;;
  -H) header=$2; shift ;;
  esac
  shift
done
case $1 in
*/catalog-version.txt)
  [ "$SITE_EXIT" = 0 ] || exit "$SITE_EXIT"
  printf '%s' "$SITE_BODY" >"$out"
  printf '%s' "$SITE_CODE"
  ;;
*/store/catalog-version)
  [ "$header" = 'x-publishable-api-key: pk_test' ] || exit 22
  [ "$API_EXIT" = 0 ] || exit "$API_EXIT"
  printf '%s' "$API_BODY"
  ;;
*) exit 3 ;;
esac
STUB
chmod +x "$bin/curl"

failures=0

check() {
  want=$1
  name=$2
  if PATH="$bin:$PATH" SITE_URL=https://site.test MEDUSA_URL=https://api.test \
    "$script" >/dev/null; then
    got=current
  else
    got=stale
  fi
  if [ "$got" = "$want" ]; then
    echo "ok - $name"
  else
    echo "not ok - $name: expected $want, got $got"
    failures=$((failures + 1))
  fi
}

export SITE_EXIT=0 SITE_CODE=200 SITE_BODY='v42
' API_EXIT=0 API_BODY='{"version":"v42"}' MEDUSA_PUBLISHABLE_KEY=pk_test
check current 'equal versions'

API_BODY='{"version":"v43"}' check stale 'the store moved on'
SITE_BODY=disabled check current 'the shop is disabled on the site'
SITE_CODE=404 SITE_BODY='Not Found' check current 'the site has no catalog-version.txt yet'
SITE_CODE=500 check stale 'the site answers 500'
SITE_EXIT=6 check stale 'the site does not resolve'
API_EXIT=22 check stale 'the store answers 400'
API_BODY='{"version":"unstamped"}' SITE_BODY=unstamped check stale 'the store was never stamped'
API_BODY='<html>' check stale 'the store answers something that is not JSON'
API_BODY='{"version":42}' check stale 'the store answers a version that is not a string'
MEDUSA_PUBLISHABLE_KEY=pk_other check stale 'the store refuses the key'
MEDUSA_PUBLISHABLE_KEY='' check stale 'no publishable key'

[ "$failures" -eq 0 ]
