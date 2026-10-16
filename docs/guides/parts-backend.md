# Parts backend (`apps/parts-backend`)

Conventions for the rest of the repo are in [`AGENTS.md`](../../AGENTS.md).
Vocabulary (Part, Fitment, Supplier, Order, etc.) is in
[`GLOSSARY.md`](../../GLOSSARY.md).

## What this is

A plain Node service, not Astro, not Medusa — a long-lived process that runs
on its own VPS rather than a Vercel function. Right now it is a health check
and nothing else; later tickets (#311+) add Part/Fitment/Order routes, Postgres
tables and the Meilisearch index on top of this scaffold. Stack: `pg` for
Postgres, `node-pg-migrate` for plain-SQL migrations, a bare `node:http`
server (no framework yet — add one only when routing beyond `/health`
actually needs it), and Meilisearch for search, reached over its own
`/health` endpoint with the built-in `fetch`.

## Local dev

```bash
cp apps/parts-backend/.env.example apps/parts-backend/.env.local
set -a; . apps/parts-backend/.env.local; set +a
pnpm --filter @podbor/parts-backend dev
```

Needs `DATABASE_URL` and `MEILI_URL` in the environment — `src/config.ts`
validates both with zod and fails loud at startup (not deep in a request
handler) if either is missing. `dev` runs the TypeScript source directly with
Node's native type-stripping (`node --watch --experimental-strip-types
src/server.ts`), the same mechanism this repo's one-off `scripts/*.ts` files
use elsewhere — no `tsx`/`ts-node-dev` dependency needed.

```bash
pnpm --filter @podbor/parts-backend build        # tsc -> dist/
pnpm --filter @podbor/parts-backend start         # node dist/server.js
pnpm --filter @podbor/parts-backend test          # vitest run --coverage
pnpm --filter @podbor/parts-backend typecheck     # tsc --noEmit
```

## Migrations

`node-pg-migrate` reads `DATABASE_URL` from the environment directly (no
`.env` loader bundled, same as the CLI's own default):

```bash
pnpm --filter @podbor/parts-backend migrate create <name>
pnpm --filter @podbor/parts-backend migrate up
pnpm --filter @podbor/parts-backend migrate down
```

`migrations/` is empty today (`.gitkeep` only) — zero tables is the expected
state until #311 adds the first one. `deploy.sh` and `restore.sh` on the VPS
both run `node_modules/.bin/node-pg-migrate up` from the built image, never
from a repo checkout.

## Health check

`GET /health` calls the pure `checkHealth()` in `src/health.ts`, which runs
`SELECT 1` against the Postgres pool and `fetch` against
`${MEILI_URL}/health`, catching each dependency's failure independently so
one being down never throws past the function. The route returns `200` with
`{ ok: true, postgres: true, meilisearch: true }` when both answer, `503`
otherwise with whichever flags are false. `src/health.ts` is the one piece of
real logic here and is the only file worth reading closely before extending
this app.

## Production: one VPS, no CI deploy job yet

Unlike `apps/medusa`, there is **no `deploy-parts-backend` job in
`ci.yml`** — no `PARTS_BACKEND_VPS_*` secrets exist yet, so wiring one now
would assume credentials nobody has. `infra/parts-backend/` holds everything
a human needs to stand the box up and ship to it by hand; a future ticket
adds the CI job once the owner hands over real VPS access.

Sizing: a Hetzner CPX22 (4 GB RAM) — see the throwaway research branch
`research/shop-infra-hosting-costs` (not merged, cited by path per this
effort's convention — see issue #309), path
`docs/research/shop-infra-hosting-costs.md`. `infra/parts-backend/docker-compose.yml`
keeps every service's `mem_limit` comfortably under that ceiling (Postgres
512m, Meilisearch 768m, the app 384m, Caddy 128m).

### Manual runbook

On a fresh box, as root:

```bash
scp infra/parts-backend/bootstrap-host.sh root@<new-host>:
ssh root@<new-host> sh bootstrap-host.sh
```

Log back in as the `deploy` user it created, then from that session:

```bash
sudo sh harden-ssh.sh
```

This locks out root login and password auth — confirm your key-based
`deploy` login works in a second terminal before closing the first.

Then, as `deploy`, copy the compose stack to `$DEPLOY_DIR` (`/srv/parts-backend`
by default):

```bash
scp -r infra/parts-backend/docker-compose.yml infra/parts-backend/caddy \
  infra/parts-backend/deploy.sh infra/parts-backend/backup.sh infra/parts-backend/restore.sh \
  infra/parts-backend/production.env.example \
  deploy@<new-host>:/srv/parts-backend/
ssh deploy@<new-host>
cd /srv/parts-backend
cp production.env.example .env
# edit .env: API_HOST, POSTGRES_PASSWORD, MEILI_MASTER_KEY
```

Build and push the image (from a machine with registry push access, or build
directly on the box):

```bash
docker buildx build --load \
  --file infra/parts-backend/Dockerfile \
  --tag ghcr.io/zikrasoft/podbor-parts-backend:<sha> \
  .
docker push ghcr.io/zikrasoft/podbor-parts-backend:<sha>
```

Then on the box:

```bash
./deploy.sh <sha>
```

`deploy.sh` pulls the image, runs migrations, restarts the stack, reloads
Caddy, and checks `https://$API_HOST/health` before pruning old images — it
refuses a malformed tag, refuses while another deploy or backup holds
`.deploy.lock`, and prints the rollback command (`./deploy.sh <previous-sha>`)
on any failure. `bootstrap-host.sh` also installs a nightly cron job that
runs `backup.sh`.

## Why Meilisearch over Typesense

Issue #310 left either acceptable. Meilisearch: a single static binary, one
official image, and a `/health` endpoint that needs nothing beyond `fetch` —
no client library justified for one GET request (ponytail: stdlib first).
