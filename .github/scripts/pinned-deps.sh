#!/bin/sh
# Every dependency is pinned exactly: pnpm add --save-exact cannot be trusted in
# this repo, so the lockfile is not the guard — this is.
set -eu

ranged=$(git ls-files '*package.json' | xargs grep -n '": *"[~^]' || true)

if [ -n "$ranged" ]; then
  echo "Ranged dependency versions found — pin them exactly:" >&2
  echo "$ranged" >&2
  exit 1
fi
