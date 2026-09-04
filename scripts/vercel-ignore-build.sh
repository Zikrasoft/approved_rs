#!/usr/bin/env bash
# Vercel's "Ignored Build Step" (see vercel.json's ignoreCommand). Runs before
# Vercel's own install step, in a container with no node_modules yet — so
# deps get installed here too, meaning every deploy installs twice. Accepted
# tradeoff for a two-person internal site over the alternative (no gate at
# all): pushes land straight on main with no PR, so GitHub's required-status-
# checks can't block them — this is the only hook Vercel gives us.
#
# Exit 1 = checks passed, proceed to build + deploy.
# Exit 0 = checks failed, skip the build, keep serving the last deployment.
set -o pipefail

pnpm install --frozen-lockfile \
  && pnpm exec eslint . \
  && pnpm exec prettier --check . \
  && pnpm exec astro check \
  && pnpm test

if [ $? -eq 0 ]; then
  echo "Checks passed — deploying"
  exit 1
else
  echo "Checks failed — skipping this deploy, previous one stays live"
  exit 0
fi
