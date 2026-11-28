#!/bin/sh
set -eu

base=$(sh "$(dirname -- "$0")/check-base.sh")
if [ -z "$base" ] || ! git diff --quiet "$base" HEAD -- \
  apps/auto-service-shop infra/auto-service-shop \
  packages/brands packages/catalog-contract packages/i18n packages/lead-crm; then
  echo true
else
  echo false
fi
