#!/bin/sh
set -eu

name=${RUNNER_NAME:-}
n=${name##*-}
case $n in
  '' | *[!0-9]*) exit 0 ;;
esac
echo "COMPOSE_PROJECT_NAME=podbor-ci-$n"
echo "SHOP_TEST_DB_PORT=$((55432 + n * 10))"
echo "SHOP_TEST_TYPESENSE_PORT=$((58108 + n * 10))"
