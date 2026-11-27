#!/bin/sh
set -eu

image=$(sed -n 's/^ *ACTIONLINT_IMAGE: *//p' .github/workflows/ci.yml)

if ! docker info >/dev/null 2>&1; then
  echo 'shellcheck-staged: docker is not running, CI shellchecks these files' >&2
  exit 0
fi

for file in "$@"; do
  shift
  set -- "$@" "${file#"$PWD"/}"
done

docker run --rm -v "$PWD:/repo" -w /repo --entrypoint shellcheck "$image" "$@"
