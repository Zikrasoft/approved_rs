#!/bin/sh
set -eu

app=${1:-}
release=${2:-}
case "$app" in
  '' | -* | *[!abcdefghijklmnopqrstuvwxyz0123456789-]*)
    echo "usage: upload-site.sh <app> <release>, the app being a site in site-env.json" >&2
    exit 2
    ;;
esac
case "$release" in
  '' | *[!0-9a-f-]*)
    echo "usage: upload-site.sh <app> <release>, the release being <sha>-<run>-<attempt>" >&2
    exit 2
    ;;
esac
for name in SITE_SECRETS SITE_VARS VPS_HOST VPS_USER VPS_SSH_KEY VPS_KNOWN_HOSTS; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is not set" >&2
    exit 2
  fi
done

scripts="$(cd "$(dirname -- "$0")" && pwd)"
site="/srv/sites/$app"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

printf '%s\n' "$VPS_SSH_KEY" >"$work/key"
printf '%s\n' "$VPS_KNOWN_HOSTS" >"$work/known_hosts"
chmod 600 "$work/key"
node --experimental-strip-types --no-warnings "$scripts/site-env.ts" "$app" "$work/site.env"
unset SITE_SECRETS SITE_VARS VPS_SSH_KEY VPS_KNOWN_HOSTS

if [ "$app" = auto-service ]; then
  if ! sh "$scripts/shop-backend-up.sh" "$work/site.env"; then
    echo "The shop backend does not answer /health, so auto-service is not built." >&2
    exit 75
  fi
  CATALOGUE_SHRINK_GUARD=true
  export CATALOGUE_SHRINK_GUARD
fi

node --env-file="$work/site.env" -e '
  const { status } = require("node:child_process").spawnSync(process.argv[1], process.argv.slice(2), { stdio: "inherit" });
  process.exit(status ?? 1);
' pnpm exec turbo run build "--filter=@podbor/$app" --env-mode=loose

remote="ssh -i $work/key -o IdentitiesOnly=yes -o UserKnownHostsFile=$work/known_hosts -o BatchMode=yes -o StrictHostKeyChecking=yes"
target="$VPS_USER@$VPS_HOST"

$remote "$target" "umask 022 && mkdir -p $site/releases/$release" </dev/null
rsync -rlp --checksum --compress --delete --stats -e "$remote" \
  "--link-dest=$site/current" \
  "apps/$app/dist/client" "apps/$app/dist/server" \
  "$target:$site/releases/$release/"
$remote "$target" "umask 077 && cat >$site/releases/$release/.env" <"$work/site.env"
$remote "$target" "/srv/carlab/deploy-site.sh $app $release" </dev/null
