#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/isolate-runner.sh"

failures=0
check() {
  if [ "$1" = "$2" ]; then
    echo "ok - $3"
  else
    echo "not ok - $3 (got '$1', want '$2')"
    failures=$((failures + 1))
  fi
}
nl='
'

check "$(RUNNER_NAME=zikrasoft-mac-3 sh "$script")" \
  "COMPOSE_PROJECT_NAME=podbor-ci-3${nl}SHOP_TEST_DB_PORT=55462${nl}SHOP_TEST_TYPESENSE_PORT=58138" \
  'a numbered runner gets its own project and ports'
check "$(RUNNER_NAME=zikrasoft-mac-10 sh "$script" | sed -n 2p)" 'SHOP_TEST_DB_PORT=55532' 'a two-digit runner number'
check "$(RUNNER_NAME=GitHub-Actions sh "$script")" '' 'a runner without a number keeps the defaults'
check "$(RUNNER_NAME=zikrasoft-mac-3a sh "$script")" '' 'a suffix that is not a number keeps the defaults'
check "$(RUNNER_NAME='' sh "$script")" '' 'an empty runner name keeps the defaults'

check "$(env -u RUNNER_NAME sh "$script")" '' 'an unset runner name keeps the defaults'

[ "$failures" -eq 0 ]
