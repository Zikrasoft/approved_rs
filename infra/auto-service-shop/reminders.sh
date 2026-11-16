#!/bin/sh
set -eu
cd "$(dirname -- "$0")"

[ -e "${SITES_ROOT:-/srv/sites}/approved-rs/current" ] || {
  echo "approved.rs has no release on this host yet, no reminders."
  exit 0
}

docker compose --profile site-approved-rs exec -T site-approved-rs node -e "
fetch('http://127.0.0.1:4321/api/reminders', {
  headers: { authorization: 'Bearer ' + process.env.CRON_SECRET },
  signal: AbortSignal.timeout(240000),
}).then(
  (response) => {
    console.log('/api/reminders answered ' + response.status);
    process.exit(response.ok ? 0 : 1);
  },
  (error) => {
    console.error('/api/reminders failed: ' + error.message);
    process.exit(1);
  },
);
"
