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
  'exec vercel env pull'*)
    cp "$PULLED" "$5"
    ;;
  'exec turbo run build'*)
    app=${5#--filter=@podbor/}
    mkdir -p "apps/$app/dist/client" "apps/$app/dist/server"
    echo "build PUBLIC_PHONE_NUMBER=${PUBLIC_PHONE_NUMBER:-} GUARD=${CATALOGUE_SHRINK_GUARD:-} KEY=${VPS_SSH_KEY:-}${VERCEL_TOKEN:-} VERCEL=${VERCEL:-}" >>"$LOG"
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

cat >"$work/full.env" <<'ENV'
VERCEL="1"
VERCEL_OIDC_TOKEN="oidc-secret"
PUBLIC_PHONE_NUMBER="381 11"
BLOB_READ_WRITE_TOKEN="blob-secret"
MEDUSA_BACKEND_URL="https://api.test"
ENV
cat >"$work/no-blob.env" <<'ENV'
PUBLIC_PHONE_NUMBER="381"
BLOB_READ_WRITE_TOKEN=""
ENV

deploy() {
  : >"$LOG"
  rm -f "$SHIPPED"
  mkdir -p "$work/tmp"
  status=0
  (
    cd "$work/repo"
    PATH="$work/bin:$PATH" TMPDIR="$work/tmp" \
      VERCEL_TOKEN=t VERCEL_ORG_ID=o VERCEL_PROJECT_ID=p \
      VPS_HOST=vps.test VPS_USER=deploy VPS_SSH_KEY="$key" VPS_KNOWN_HOSTS='vps.test ssh-ed25519 AAAA' \
      sh "$script" "$@"
  ) >"$work/out" 2>&1 || status=$?
}

key='key-secret'
PULLED="$work/full.env"
export PULLED

deploy detailing abc123-1-1
check "$status" 0 'a site with every variable deploys'
check "$(has 'pnpm exec vercel env pull .* --yes --environment=production')" yes 'the env comes from the Vercel production environment'
check "$(has 'build PUBLIC_PHONE_NUMBER=381 11 GUARD= KEY= VERCEL=$')" yes 'the build sees the pulled env without the Vercel system variables or the deploy secrets'
check "$(has 'pnpm exec turbo run build --filter=@podbor/detailing')" yes 'turbo builds the app'
check "$(has 'rsync .*--checksum.*--link-dest=/srv/sites/detailing/current .*apps/detailing/dist/client apps/detailing/dist/server deploy@vps.test:/srv/sites/detailing/releases/abc123-1-1/$')" yes 'rsync ships client and server into the release, hard-linking what current already has'
check "$(cat "$SHIPPED")" 'PUBLIC_PHONE_NUMBER="381 11"
BLOB_READ_WRITE_TOKEN="blob-secret"
MEDUSA_BACKEND_URL="https://api.test"' 'the runtime .env is the pulled env without the Vercel system variables'
check "$(has "ssh .*umask 077.*/srv/sites/detailing/.env")" yes 'the runtime .env is written owner-only'
check "$(tail -n 1 "$LOG" | grep -c '/srv/carlab/deploy-site.sh detailing abc123-1-1$')" 1 'the host deploy script switches to the release last'
check "$(has curl)" no 'only auto-service probes the shop backend'
check "$(grep -c -e blob-secret -e key-secret -e oidc-secret "$work/out" || true)" 0 'no secret reaches the output'
check "$(find "$work/tmp" -type f | wc -l | tr -d ' ')" 0 'the pulled env and the key are deleted'

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

PULLED="$work/no-blob.env"
deploy approved-rs abc123-1-1
check "$status" 1 'an empty required variable fails the deploy'
check "$(grep -c 'BLOB_READ_WRITE_TOKEN' "$work/out")" 1 'the failure names the missing variable'
check "$(has 'turbo\|rsync\|ssh')" no 'nothing is built or shipped without it'
PULLED="$work/full.env"

deploy shop abc123-1-1
check "$status" 2 'an unknown app is refused'

deploy detailing
check "$status" 2 'a missing release is refused'

key=''
deploy detailing abc123-1-1
check "$status" 2 'a missing secret is refused'
check "$(grep -c VPS_SSH_KEY "$work/out")" 1 'the refusal names the missing secret'
check "$(has 'pnpm\|rsync\|ssh')" no 'nothing runs without the secrets'

[ "$failures" -eq 0 ]
