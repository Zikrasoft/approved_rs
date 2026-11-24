#!/bin/sh
set -eu

base="$1"
shift
! git diff --quiet "$base" HEAD -- \
  pnpm-lock.yaml pnpm-workspace.yaml turbo.json package.json \
  .npmrc .node-version .pnpmfile.cjs \
  .github/actions/setup-pnpm/action.yml "$@"
