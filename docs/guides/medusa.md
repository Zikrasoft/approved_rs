# Medusa backend (`apps/medusa`)

Carried over from staywildwear's backend, where each rule cost a bug.
Conventions for the rest of the repo are in [`AGENTS.md`](../../AGENTS.md).

- **CommonJS app.** Relative imports carry no extension. The one bare-node file
  is `scripts/translate-i18n.ts` (the CI translate loop runs it); it imports with
  `.ts` extensions and is excluded from `tsconfig.json`.
- **The translation module needs two switches**: `modules: [{ resolve:
'@medusajs/medusa/translation' }]` gives the tables and the service,
  `featureFlags: { translation: true }` gives the routes and Store API
  localisation. Either alone looks enabled and is not (spike 0b).
- **Middleware that changes a request body mutates both `req.validatedBody` and
  `req.body`.** The core validator runs first and the route reads
  `validatedBody`.
- **`metadata` is written read-merge-write under a lock** (`src/lib/metadata.ts`).
  Medusa's own product card does send a partial `metadata`, and the core
  repository merges it in (an empty string `''` deletes a key) — our code
  writes `metadata` only through `src/lib/metadata.ts`, never by posting a
  partial object straight to the product route.
- **Subscribe to workflow events, and write translations only through
  `createTranslationsWorkflow`/`batchTranslationsWorkflow`** — they emit
  `translation.*`, the module service does not.
- **Providers register only when their keys exist** (`brevoOptions()` → else
  `notification-local`); overriding `fulfillment` lists `manual` again;
  `databaseDriverOptions` always states `ssl`.
- **Seeds are idempotent by identity** (name, handle, code) and never overwrite
  what the owner edited in the admin.
- **Event retries need Redis**: `event-bus-redis` runs with
  `jobOptions.attempts: 5`; a subscriber that throws is retried alone, the ones
  that succeeded are not re-run.
- **Tests**: jest (`@medusajs/test-utils` requires it). `pnpm --filter
@podbor/medusa test` runs the unit suite (`src/**/__tests__/**/*.unit.spec.ts`)
  with no database. The HTTP suite needs `docker compose -f
apps/medusa/docker-compose.test.yml up -d --wait`; `DB_HOST` is the literal
  `localhost` (test-utils turns SSL on otherwise and the pool hangs); tests never
  go to the network (`integration-tests/setup.js`); seed in the top-level
  `beforeAll` (the runner restores that snapshot before each test); a two-run
  idempotency check runs both runs inside one test; never pick `variants[0]` of a
  multi-variant product. `.env` is always loaded; the integration config blanks
  `PORT` so each worker gets a free port.
- **Admin product writes are guarded in `require-fields.ts`**: batch edits of
  spec/fitment/type/status, CSV import, and registry product-type rename/delete
  are all refused there. Any new admin write path that can touch spec, type,
  status or price must go through those same guards.
- **The release job filters fulfilment and capture in memory, not in the query.**
  `Order.fulfillment_status` is not a queryable property — `query.graph` throws
  `Trying to query by not existing property Order.fulfillment_status`, proven by
  `release-uncollected.spec.ts`. It also validates the rows it got with zod and
  skips any order whose `fulfillments`/`payment_collections` the query did not
  return: `cancelOrderWorkflow` refuses an order with a live fulfilment, but it
  **refunds** captured payments rather than refusing, so a missing relation read
  as "nothing captured" would cancel and refund a paid order.
- **A 409 is written with `res.status(409).json(...)`, never thrown** — the
  error handler rewrites `CONFLICT` messages, so a thrown `MedusaError` of that
  type would not reach the client with the Russian reason intact.
- **Middleware string matchers are exact express paths, not prefixes**:
  `/admin/products/:id` also matches `/admin/products/batch` and
  `/admin/products/imports` — the guards on that route bail out on
  `req.params.id === 'batch'` for exactly this reason.
- **Fitment is checked for shape only, against no dictionary.** A product's
  `metadata.fitment` entries are free-text make/model plus a year range, typed
  in the admin and validated by `fitmentSchema` in `@podbor/shop-catalog`;
  two products can spell one car differently and nothing catches it. The
  dictionary that used to be the join key was deleted before launch
  (`docs/adr/0028-no-vehicle-dictionary-until-fitment-is-required.md`) and comes
  back when a product type with **required** fitment ships.
- Locally the backend runs on port 9009 (`pnpm --filter @podbor/medusa develop`);
  the script is not called `dev`, so the root `pnpm dev` does not start it.
- In CI `typecheck` runs through turbo after `medusa build` (`.medusa/types` is
  generated output); a bare `pnpm --filter @podbor/medusa typecheck` on a clean
  checkout does not see those generated query types.
- **Redis event-bus subscribers share one queue at concurrency 1**: no long
  work in a subscriber without a timeout — `order.placed` does not jump the
  queue in 2.19.
- **Translations are stamped per locale**: `metadata.translated_from_sr` /
  `translated_from_en` store a hash of the Russian source (title/subtitle/description)
  that locale was last translated from; `translate-product` re-translates only
  locales whose stored hash differs from the current Russian, and the hourly
  `translate-backlog` job retries any locale still behind.
- **`store.metadata.catalog_version` bumps on a catalog write**;
  `GET /store/catalog-version` reads it back and needs the publishable key
  like any other Store API route — that's what the CI scope step compares
  against `catalog-version.txt`.
- **`order.placed` fans out to two independent subscribers.** The hook
  subscriber signs and validates the card and gets 5 attempts (~2.5 min) from
  the event bus, and is not deduped on this side — the receiver (`/api/shop-order`,
  Plan 4, not built yet) must dedupe by `orderId`, because a 2xx that times out
  gets retried. The email subscriber is deduped per order (checks `listNotifications`
  before sending), so a retried delivery never emails the customer twice.
- **`emails.yaml` is RU-only**, like every other i18n source file — sr/en are
  filled by the same CI translate loop (`apps/*/scripts/translate-i18n.ts`)
  that covers the rest of the site copy, nothing Medusa-specific.
- **Production is `infra/medusa`: one VPS, one compose stack, deployed by
  `ci.yml`.** `medusa-image` builds `infra/medusa/Dockerfile` from the
  translate job's sha, migrates a blank database with it and boots it to
  healthy; on `main` it pushes `ghcr.io/zikrasoft/podbor-medusa:<sha>` and
  `deploy-medusa` runs `infra/medusa/deploy.sh <sha>` on the host. `deploy-medusa`
  itself only holds `contents: read` — the separate `record-medusa` job moves
  `deployed/medusa`, so the one-shot GHCR token shipped to the VPS never carries
  repo-write. Migrations, seeds and `medusa user` run from the image
  (`node_modules/.bin/medusa … ./src/scripts/<name>.js` under `/server`),
  never from a repo checkout — the image has no ts-node. The Dockerfile
  `require()`s every `@podbor/*` subpath Medusa imports; a new subpath goes
  into that smoke line. A change under `infra/medusa/` redeploys medusa on its
  own scope rule, because turbo cannot see files outside the workspace.
- **Caddy is the single hop in front of Medusa.** Medusa runs with
  `trust proxy 1`, Caddy overwrites `X-Forwarded-For` with the peer address,
  and only Caddy publishes a port (`infra/medusa/test/compose.test.sh`). The
  rate limits key on `req.ip` — IPv6 by its /64 (`clientKey` in
  `rate-limit.ts`). A CDN or second proxy in front would turn every client
  into the proxy's address: change the proxy count, `trust proxy` and the
  Caddy header together or not at all.
- **A `pnpm-lock.yaml` change redeploys all four apps, medusa included** —
  decided in Plan 3: one lockfile, no way to attribute a change to one app,
  and a redundant deploy is the cheap failure direction. `setup-pnpm`
  installing Medusa in every job is accepted on the same grounds until it
  measurably hurts.
