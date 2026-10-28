#!/bin/sh
set -eu

root="$(cd "$(dirname -- "$0")/../.." && pwd)"
template=${1:-$root/infra/carlab-shop/production.env.example}

awk -v placeholder=ci-placeholder '
  function split_line(line) {
    key = substr(line, 1, index(line, "=") - 1)
    value = substr(line, index(line, "=") + 1)
  }
  NR == FNR {
    split_line($0)
    stack[key] = value
    order[++count] = key
    next
  }
  /^[A-Za-z_][A-Za-z0-9_]*=/ {
    split_line($0)
    if (key in stack) {
      value = stack[key]
      written[key] = 1
    } else if (value == "") {
      value = placeholder
    }
    print key "=" value
  }
  END {
    for (i = 1; i <= count; i++) {
      if (!(order[i] in written)) print order[i] "=" stack[order[i]]
    }
  }
' - "$template" <<'STACK'
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/medusa
TYPESENSE_HOST=127.0.0.1
TYPESENSE_PORT=58108
TYPESENSE_API_KEY=xyz
FILE_URL=https://carlab-public.s3.eu-central-1.amazonaws.com
S3_ENDPOINT=
TELEGRAM_GROUP_ID=
SENTRY_DSN=
STACK
