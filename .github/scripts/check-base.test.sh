#!/bin/sh
set -eu

scripts="$(cd "$(dirname -- "$0")" && pwd)"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
check() {
  if [ "$1" = "$2" ]; then
    echo "ok - $3"
  else
    echo "not ok - $3 (got '$1', want '$2')"
    failures=$((failures + 1))
  fi
}
commit() {
  mkdir -p "$(dirname -- "$1")"
  echo "$2" >"$1"
  git add "$1"
  git commit -qm "$1"
  git rev-parse HEAD
}
base() {
  sh "$scripts/check-base.sh" 2>/dev/null
}

cd "$work"
git init -q -b main
git config user.email ci@example.com
git config user.name ci
mkdir -p .github/scripts
cp "$scripts/root-changed.sh" .github/scripts/
git add .github
first=$(commit apps/a/index.ts one)

check "$(base)" '' 'no deployed tag checks everything'

git tag deployed/a "$first"
second=$(commit apps/b/index.ts one)
git tag deployed/b "$second"
commit apps/a/index.ts two >/dev/null
check "$(base)" "$first" 'the oldest deployed commit is the base'

git tag -a -m shop deployed/shop "$second"
check "$(base)" "$first" 'an annotated tag is read as its commit'

check "$(FORCE=true base)" "$first" 'a forced run checks only what changed'

commit pnpm-lock.yaml changed >/dev/null
check "$(base)" '' 'a lockfile change checks everything'
git tag -f deployed/a HEAD >/dev/null
git tag -f deployed/b HEAD >/dev/null
git tag -f deployed/shop HEAD >/dev/null

commit .github/workflows/ci.yml changed >/dev/null
check "$(base)" '' 'a workflow change checks everything'
git tag -f deployed/a HEAD >/dev/null
git tag -f deployed/b HEAD >/dev/null
git tag -f deployed/shop HEAD >/dev/null
tip=$(git rev-parse HEAD)

commit eslint.config.js changed >/dev/null
check "$(base)" '' 'a lint config change checks everything'
git reset -q --hard "$tip"

commit packages/p/index.ts changed >/dev/null
check "$(base)" "$tip" 'a package change is checked against the base'

git checkout -q -b side "$first"
commit apps/c/index.ts side >/dev/null
git tag -f deployed/b HEAD >/dev/null
git checkout -q main
check "$(base)" '' 'a deployed commit off this history checks everything'

git merge -q --no-edit side
git tag -f deployed/a "$tip" >/dev/null
check "$(base)" '' 'deployed commits on merged branches check everything'

[ "$failures" -eq 0 ]
