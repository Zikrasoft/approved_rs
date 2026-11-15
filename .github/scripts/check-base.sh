#!/bin/sh
set -eu

full() {
  echo "Checking everything: $1" >&2
  exit 0
}

[ "${FORCE:-false}" = true ] && full 'forced from workflow_dispatch'

deployed=$(git for-each-ref \
  --format='%(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end)' \
  'refs/tags/deployed/*' | sort -u)
[ -n "$deployed" ] || full 'no deployed/ tag yet'

for commit in $deployed; do
  git merge-base --is-ancestor "$commit" HEAD || full "deployed commit $commit is not an ancestor of HEAD"
done

base=$(printf '%s\n' "$deployed" | xargs git merge-base --octopus) || full 'deployed commits share no ancestor'
printf '%s\n' "$deployed" | grep -qx "$base" || full "the deployed commits' merge-base $base was never deployed"

sh "$(dirname -- "$0")/root-changed.sh" "$base" \
  .github eslint.config.js prettier.config.js .prettierignore \
  && full "root build files changed since $base"

echo "Checking what changed since $base" >&2
echo "$base"
