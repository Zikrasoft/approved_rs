#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/shop-backend-up.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"
cat >"$work/bin/curl" <<'STUB'
#!/bin/sh
echo "curl $*" >>"$LOG"
exit "${HEALTH_EXIT:-0}"
STUB
chmod +x "$work/bin/curl"
LOG="$work/log"
export LOG

failures=0
check() {
  if [ "$1" = "$2" ]; then
    echo "ok - $3"
  else
    echo "not ok - $3"
    failures=$((failures + 1))
  fi
}
probe() {
  : >"$LOG"
  printf '%s\n' "$@" >"$work/env"
  status=0
  PATH="$work/bin:$PATH" sh "$script" "$work/env" >/dev/null 2>&1 || status=$?
}

probe 'OTHER=1'
check "$status:$(cat "$LOG")" '0:' 'no backend URL means nothing to probe'

probe 'MEDUSA_BACKEND_URL=""'
check "$status:$(cat "$LOG")" '0:' 'an empty backend URL means nothing to probe'

probe 'MEDUSA_BACKEND_URL="https://api.test/"'
check "$status" 0 'a healthy backend passes'
check "$(grep -c 'https://api.test/health$' "$LOG")" 1 'the probe hits /health once'

HEALTH_EXIT=7
export HEALTH_EXIT
probe 'MEDUSA_BACKEND_URL=https://api.test'
check "$status" 1 'a backend that does not answer fails the probe'

[ "$failures" -eq 0 ]
