#!/bin/sh
set -eu
cd "$(dirname -- "$0")"
cat caddy-image/Dockerfile caddy/Caddyfile caddy/security-headers.caddy |
  { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-40
