#!/bin/sh
set -eu

script="$(cd "$(dirname -- "$0")" && pwd)/deploy-site.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/repo/apps/auto-service" "$work/repo/apps/detailing" "$work/repo/apps/approved-rs"

cat >"$work/bin/pnpm" <<'STUB'
#!/bin/sh
echo "pnpm $*" >>"$LOG"
case "$*" in
  'exec turbo run build'*)
    app=${5#--filter=@podbor/}
    mkdir -p "apps/$app/dist/client" "apps/$app/dist/server"
    echo "build PUBLIC_PHONE_NUMBER=${PUBLIC_PHONE_NUMBER:-} GUARD=${CATALOGUE_SHRINK_GUARD:-} KEY=${VPS_SSH_KEY:-} JSON=${SITE_SECRETS:-}${SITE_VARS:-}" >>"$LOG"
    ;;
esac
STUB
cat >"$work/bin/ssh" <<'STUB'
#!/bin/sh
echo "ssh $*" >>"$LOG"
case "$*" in
  *'.env'*) cat >"$SHIPPED" ;;
esac
STUB
cat >"$work/bin/rsync" <<'STUB'
#!/bin/sh
echo "rsync $*" >>"$LOG"
STUB
cat >"$work/bin/curl" <<'STUB'
#!/bin/sh
echo "curl $*" >>"$LOG"
exit "${HEALTH_EXIT:-0}"
STUB
chmod +x "$work/bin/"*

LOG="$work/log"
SHIPPED="$work/shipped.env"
export LOG SHIPPED

failures=0
check() {
  if [ "$1" = "$2" ]; then
    echo "ok - $3"
  else
    echo "not ok - $3 (got '$1', want '$2')"
    failures=$((failures + 1))
  fi
}
has() {
  if grep -q -e "$1" "$LOG"; then echo yes; else echo no; fi
}

shared_secrets='"TELEGRAM_BOT_TOKEN":"1:crm-secret","TELEGRAM_GROUP_ID":"-100"'
site_secrets='"KEYSTATIC_GITHUB_CLIENT_ID":"id","KEYSTATIC_GITHUB_CLIENT_SECRET":"kgs-secret","KEYSTATIC_SECRET":"ks-secret","TELEGRAM_CAPTURE_BOT_TOKEN":"2:capture-secret","TELEGRAM_CAPTURE_WEBHOOK_SECRET":"tcws-secret","CRON_SECRET":"cron-secret","TELEGRAM_WEBHOOK_SECRET":"tws-secret","MEDUSA_PUBLISHABLE_KEY":"pk-secret","OPENAI_API_KEY":"openai-secret","github_token":"ghs-secret"'
all_secrets="{$shared_secrets,$site_secrets}"
vars='{"TELEGRAM_BOT_USERNAME":"SerbCRMBot","PUBLIC_PHONE_NUMBER":"381 11","PUBLIC_WHATSAPP_NUMBER":"381","PUBLIC_VIBER_NUMBER":"381","PUBLIC_KEYSTATIC_GITHUB_APP_SLUG":"app","PUBLIC_THREADS_CHANNEL":"t","MEDUSA_BACKEND_URL":"https://api.test","RUNNER":"self-hosted"}'

deploy() {
  : >"$LOG"
  rm -f "$SHIPPED"
  mkdir -p "$work/tmp"
  status=0
  (
    cd "$work/repo"
    PATH="$work/bin:$PATH" TMPDIR="$work/tmp" \
      SITE_SECRETS="$secrets" SITE_VARS="$vars" \
      VPS_HOST=vps.test VPS_USER=deploy VPS_SSH_KEY="$key" VPS_KNOWN_HOSTS='vps.test ssh-ed25519 AAAA' \
      sh "$script" "$@"
  ) >"$work/out" 2>&1 || status=$?
}

key='key-secret'
secrets=$all_secrets

deploy detailing abc123-1-1
check "$status" 0 'a site with every variable deploys'
check "$(has vercel)" no 'the env no longer comes from Vercel'
check "$(has 'build PUBLIC_PHONE_NUMBER=381 11 GUARD= KEY= JSON=$')" yes 'the build sees the site env without the deploy secrets or the secrets JSON'
check "$(has 'pnpm exec turbo run build --filter=@podbor/detailing')" yes 'turbo builds the app'
check "$(has 'rsync .*--checksum.*--link-dest=/srv/sites/detailing/current .*apps/detailing/dist/client apps/detailing/dist/server deploy@vps.test:/srv/sites/detailing/releases/abc123-1-1/$')" yes 'rsync ships client and server into the release, hard-linking what current already has'
check "$(cat "$SHIPPED")" "TELEGRAM_BOT_TOKEN='1:crm-secret'
TELEGRAM_BOT_USERNAME='SerbCRMBot'
TELEGRAM_GROUP_ID='-100'
PUBLIC_PHONE_NUMBER='381 11'
PUBLIC_KEYSTATIC_GITHUB_APP_SLUG='app'
KEYSTATIC_GITHUB_CLIENT_ID='id'
KEYSTATIC_GITHUB_CLIENT_SECRET='kgs-secret'
KEYSTATIC_SECRET='ks-secret'
TELEGRAM_CAPTURE_BOT_TOKEN='2:capture-secret'
TELEGRAM_CAPTURE_WEBHOOK_SECRET='tcws-secret'
PUBLIC_WHATSAPP_NUMBER='381'
PUBLIC_VIBER_NUMBER='381'" 'the runtime .env holds only the names the manifest gives detailing'
check "$(has "ssh .*umask 077 && cat >/srv/sites/detailing/releases/abc123-1-1/.env$")" yes 'the runtime .env is written owner-only into the release, so a rollback takes its env along'
check "$(grep -A1 '^rsync' "$LOG" | tail -n 1 | grep -c 'releases/abc123-1-1/.env')" 1 'the .env is written right after rsync, which would delete it'
check "$(tail -n 1 "$LOG" | grep -c '/srv/carlab/deploy-site.sh detailing abc123-1-1$')" 1 'the host deploy script switches to the release last'
check "$(has curl)" no 'only auto-service probes the shop backend'
check "$(grep -c -e '-secret' "$work/out" || true)" 0 'no secret reaches the output'
check "$(find "$work/tmp" -type f | wc -l | tr -d ' ')" 0 'the site env and the key are deleted'

deploy approved-rs abc123-1-1
check "$status" 0 'approved-rs deploys with its own names'
check "$(grep -c -e '^CRON_SECRET=' -e '^PUBLIC_THREADS_CHANNEL=' "$SHIPPED")" 2 'approved-rs ships its own names'
check "$(grep -c -e MEDUSA -e OPENAI "$SHIPPED" || true)" 0 'approved-rs ships no other site names'

deploy auto-service abc123-1-1
check "$status" 0 'auto-service deploys while the shop backend answers'
check "$(has 'curl .*https://api.test/health')" yes 'auto-service probes the shop backend'
check "$(has 'build .* GUARD=true ')" yes 'the carlab production build guards the catalogue against shrinking'

HEALTH_EXIT=7
export HEALTH_EXIT
deploy auto-service abc123-1-1
check "$status" 75 'a silent shop backend stops auto-service with its own exit code'
check "$(has 'turbo\|rsync\|ssh')" no 'nothing is built or shipped without the shop backend'
unset HEALTH_EXIT

secrets="{$site_secrets}"
deploy detailing abc123-1-1
check "$status" 1 'a missing required variable stops the deploy'
check "$(grep -c 'required TELEGRAM_BOT_TOKEN (secret), TELEGRAM_GROUP_ID (secret) not set' "$work/out")" 1 'the refusal names every missing variable'
check "$(has 'turbo\|rsync\|ssh')" no 'nothing is built or shipped without them'
check "$(grep -c -e '-secret' "$work/out" || true)" 0 'the refusal prints no value'
check "$(find "$work/tmp" -type f | wc -l | tr -d ' ')" 0 'a refused deploy leaves no key behind'
secrets=$all_secrets

deploy shop abc123-1-1
check "$status" 2 'an unknown app is refused'

deploy detailing
check "$status" 2 'a missing release is refused'

secrets=''
deploy detailing abc123-1-1
check "$status" 2 'a missing secrets JSON is refused'
check "$(grep -c SITE_SECRETS "$work/out")" 1 'the refusal names the missing JSON'
secrets=$all_secrets

key=''
deploy detailing abc123-1-1
check "$status" 2 'a missing secret is refused'
check "$(grep -c VPS_SSH_KEY "$work/out")" 1 'the refusal names the missing secret'
check "$(has 'pnpm\|rsync\|ssh')" no 'nothing runs without the secrets'

[ "$failures" -eq 0 ]
