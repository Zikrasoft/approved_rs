# AGENTS.md

Instructions for any coding agent working in this repository. Claude Code reads
this file directly; other agents pick it up through the same
[AGENTS.md](https://agents.md) convention.

## Monorepo layout

pnpm workspace + Turborepo. Apps live in `apps/*`, shared packages in `packages/*`.

```
apps/approved-rs/     Approved.rs, the approved.rs site (Astro) — most of this document describes it
apps/detailing/       Details, the detailing studio site — details.rs
apps/auto-service/    CarLab, the car service site + parts shop — carlab.rs
apps/medusa/          CarLab shop backend — Medusa 2.19, CommonJS, api.carlab.rs
infra/medusa/         CarLab shop production: image, compose (postgres, redis, medusa, caddy), host scripts — one Hetzner VPS
packages/lead-crm/    lead store, Telegram bot, and the lead/contact-click routes
packages/i18n/        locale set, YAML/zod section loader, auto-translate runners
packages/site-kit/    brand-agnostic mechanics: safeMarkdown, formatPhone, visitor id, lazy map embed, scroll lock, modal dialog, preferred contact channel (owns the `data-contact-order` / `data-channel` / `data-primary-contact` / `data-primary-channel` markup contract the apps must honour), funnel tracking (owns a second one: `data-lead-form` / `data-brand-link` / `data-field` / `aria-invalid`)
packages/brands/      the three brands: domains, display names, locale mapping, ops service labels, the shared workshop address
packages/shop-catalog/ CarLab shop machinery: product-type registry, attribute schemas, fitment, facets, landing pages, price format, signed order webhook (dual ESM/CJS for Medusa)
```

Each of the three sites owns its own `astro.config.mjs`, `keystatic.config.ts`,
`vercel.json` and `vitest.config.ts`; every workspace app, `apps/medusa`
included, has its own `tsconfig.json` and `.env*` (`apps/medusa` uses jest
instead of vitest and is not a Vercel deploy, so it has neither `vercel.json`
nor `vitest.config.ts`). Lint/format configs and the
lockfile stay at the repo root and cover every workspace. The root
`vercel.json` holds `git.deploymentEnabled: false` — without it every branch
push triggers a failing preview build. **The same block is now duplicated into
all three sites' `vercel.json` on purpose.** Why: `docs/adr/0007-github-actions-builds-vercel-only-hosts.md`.

Unqualified paths in this document are relative to `apps/approved-rs/`:
`src/lib/store.ts` means `apps/approved-rs/src/lib/store.ts`.

**Brand identity lives in `packages/brands`, never in a literal.** Per-brand
constants (`APPROVED` / `CARLAB` / `DETAILS`) carry the domain, display name and
legal name; `BRANDS` and `BRAND_SITES` aggregate them; `brandLocale()` maps
approved.rs's five locales onto the brand sites' three (`es`/`de` fall to `en`).

**Import your own brand's constant, never the aggregate.** `BRANDS` is a plain
object, so reading one key keeps all three alive in any chunk that imports the
module — a brand site whose `constants.ts` reaches a client script would then
ship its siblings' domains and legal names. Each app pins its brand once
(`export const BRAND = CARLAB`) in `src/utils/constants.ts`, and
`astro.config.mjs` imports the same constant for `site:`. Only approved.rs may
touch the aggregate, and only in the three places that genuinely need every
brand: the cross-brand link builder, the legacy-redirect host map in
`middleware.ts`, and the partner block that links to both sister sites.

`vercel.json` cannot import anything, so the domains stay hand-duplicated there
— and in `src/i18n/translateConfig.ts`, which the translate scripts load under
bare node where `import.meta.env` does not exist.

The brands were chosen to satisfy one rule: no shared brand root between the
three sites, and nothing carrying Approved's trust/verification semantics.

**One bot, one chat, one lead store, three brands.** Telegram allows a single
webhook URL per bot, so `api/telegram-webhook.ts` and `api/reminders.ts` are
deployed only by `apps/approved-rs`; the other two apps ship just `/api/leads`
and `/api/contact-click`. All three write to the same `data/leads.json` on the
same Vercel Blob store and are separated by the lead's `brand` field, which the
app's `createNotifyLead({ brand })` stamps on — a visitor can never set it.
Connect the same Blob store to all three Vercel projects.

**A lead captured for a sister brand is stored as that brand's.** approved.rs's
partner block can open its own form for CarLab or Details, and
`src/lib/notifyLead.ts` maps the partner service slug onto that brand's name and
commission rate (`PARTNER_SERVICE` and `COMMISSION_PERCENT` in
`packages/brands`) before the store sees the lead. So `brand` still means "whose
lead this is", the per-brand rate is right from the start — a stored lead keeps
the rate it was created with — and `source_url` is what says the visitor came
from approved.rs. The visitor still cannot name a brand: they can only pick one
of the two partner slugs the page renders, and every other value falls through
to approved.rs itself.

**A `packages/*` change deploys all three sites, and that is the point.** The
deploy filter in `ci.yml` is `turbo --filter="...[<deployed tag>]"` — the
leading dots pull in the dependents of a changed package, so touching
`@podbor/lead-crm` or `@podbor/i18n` marks all three sites stale at once
(`@podbor/i18n`, `@podbor/brands` and `@podbor/shop-catalog` also mark
`apps/medusa` stale; its `deploy-medusa` job ships it in the same run, before
all three sites, and a failed medusa deploy holds all three back). All
three write the same `data/leads.json` blob, so shipping a changed package to
one site and not the others puts two versions of the lead schema on one file:
one site writes records another cannot parse, and they land in
`data/leads-unreadable.json` for someone to sort out by hand. Nothing else
enforces this — no test and no schema can see a half-deployed package. Do not
narrow that filter to the app directories, and do not move a `deployed/*` tag
forward by hand.

**Each site writes its own leads.** A brand site posts to its own
server-side route rather than another brand's origin — three separate Vercel
projects on three separate domains, so a cross-origin POST buys nothing but a
CORS config to maintain.

**Why packages exist:** this repo is becoming a portfolio of deliberately
independent brand sites (see `docs/adr/0001-one-repo-three-independent-brand-sites.md`). The
shared code is the machinery — lead capture, i18n — never the visual identity.
Design systems and components stay per-app because each brand gets its own
look, not because the sites have to hide that they are relatives. **The sites
being traceable to each other is not a finding** — a shared typeface, a similar
palette, one repository, one Keystatic admin, one phone number. The only rule
is branding: no shared brand root between the three, and nothing carrying
Approved's trust/verification semantics.

**Package rules:**

- **Read `packages/*` before writing anything new.** Scroll lock, modal dialog,
  locale choice, lazy map embed, phone formatting, markdown sanitising and the
  visitor id already live there; reach for the existing helper and adapt it
  rather than growing a second implementation in an app.
- **The second copy is the signal.** The moment the same helper would exist in
  two apps, it belongs in a package instead — and it moves together with its
  tests, never ahead of them. What stays per-app is markup and styling — each
  brand owns its own look; what moves is behaviour.
  Spotting a shareable mechanism is reason enough to extract it now, not later.
- **An extraction is finished only when every call site uses it.** Wiring the
  new package into the one app you were editing leaves the other copies alive
  and the divergence intact, which is what the extraction was supposed to end.
  The same holds for defects: a bug found in one app gets checked and fixed in
  the other two in the same pass. Three copies of one nav helper with inverted
  argument order, and a broken re-implementation of an already-extracted phone
  helper, both reached review this way.
- **Client behaviour is a vanilla custom element**, not an ad-hoc script or a
  framework island. `defineLazyMapEmbed` and `defineLocaleChoice` in
  `packages/site-kit/src` are the shape: idempotent `define(tagName?)`, no
  auto-registration on import, no styles shipped, the app supplying the markup.
  A run-once page effect with no per-instance state is the one exception —
  `defineContactClickTracking`, `applyPreferredContactOrder` and
  `defineFunnelTracking` are plain functions called once from the app's layout,
  because what they hold belongs to the page, not to an element. Such a function
  must guard against being armed twice (`defineFunnelTracking`'s module flag,
  `defineAnalytics`'s `window.loadAnalytics` check) — a second call that
  re-attaches listeners doubles whatever it counts, silently. Anything with
  instance state is still a custom element.
- Every `packages/*` carries its own test suite at **100% coverage**
  (statements/functions/lines; branches too where achievable). The `test`
  script runs `vitest run --coverage`, so the threshold is enforced by CI
  rather than being decorative.
- Packages are configured per business, never per hardcoded assumption:
  the commission rate, the locale list, the storage key and the service labels
  are all config. Operator-facing Russian bot copy is _not_ — it is the same
  for every brand and lives in the package, contact-channel labels included
  (`CHANNEL_LABELS` in `packages/lead-crm/src/telegram/format.ts`, after three
  byte-identical copies of it sat in the apps' `crmBot.ts`).
- **`SOURCE_LOCALE = 'ru'` in `packages/i18n` is a deliberate exception** to that
  rule. It is the language content is authored in, not a locale a site serves,
  and the whole auto-translate pipeline is built on every app writing Russian and
  the `translate` job filling the rest. `createLocaleSet` throws if `'ru'` is
  missing from the locale list. Which locale a site _presents_ by default is a
  separate, per-app field — `primaryLocale`, required, driving `x-default` and
  the `detectLocale` fallback. Do not conflate the two: swapping them silently
  renders Serbian pages in Russian, and no test catches it. A future brand that
  authors in another language turns `SOURCE_LOCALE` into config; until one
  exists, that would be configuration for a single caller.
- The app binds a package through a thin re-export file (`src/lib/store.ts`,
  `src/lib/telegram/index.ts`, `src/i18n/config.ts`). That keeps the ~950 lines
  of API-route call sites and ~190 `.astro` i18n call sites free of churn when
  a package's internals move. Wire new packages the same way.
- `packages/site-kit` is mechanics only, never visual. `safeMarkdown` is the
  XSS boundary for auto-translated content, `formatPhone` and the visitor id
  are pure helpers. A component or a design token does not go in here — not
  because two sites must not resemble each other, but because a shared token
  makes every brand's look a change to one file, and each brand owns its own.
- Client-side imports go through a narrow subpath export
  (`@podbor/lead-crm/contact-channel`, `@podbor/site-kit/browser`,
  `@podbor/shop-catalog/browser`), never the package root: the root barrel
  pulls zod, date-fns and the Telegram client into the browser bundle.
- **A package Medusa consumes ships a CommonJS build behind a `require`
  condition.** `apps/medusa` is CommonJS and cannot load the `.ts` sources the
  other workspaces import. `packages/shop-catalog` (`.`, `./browser`,
  `./order-hook`), `packages/brands` and `@podbor/i18n`'s `./translate/core` and
  `./section` export `{ "require": dist/cjs…, "default": src/….ts }`, build with
  `tsc -p tsconfig.cjs.json` (`module: CommonJS`, `rewriteRelativeImportExtensions`)
  and stamp `dist/cjs/package.json` with `{"type":"commonjs"}`. Their `test` task
  depends on their own `build` in `turbo.json`, and a `cjs.test.ts` `require()`s
  the result — so run such a package's tests through turbo
  (`pnpm turbo run test --filter=<package>`); a bare `pnpm --filter <package> test`
  finds no `dist/`.
- **Two slug helpers on purpose.** Medusa product handles use
  `apps/medusa/src/lib/translit.ts` (slugify, Russian transliteration:
  `Аккумулятор тест` → `akkumulyator-test`); storefront landing slugs use
  `landingSlug` in `@podbor/shop-catalog` (ASCII-folds spec values such as
  `5W-30` or `60 Ah`). Different inputs, different jobs — do not merge them.
- **A helper a lazily-loaded path depends on must live in a module that imports
  nothing heavy.** Rollup cannot code-split a module that is also statically
  imported, so putting such a helper beside a static `libphonenumber-js` import
  inlines the whole library into the eager chunk — measured at 3 KB → 185 KB on
  the lead form, a 60× regression aimed squarely at slow connections. Hence
  `@podbor/lead-crm/compose-e164` and `/phone-input`, zero-import subpaths
  separate from `/phone`. When extracting, check the emitted chunk, not the
  source — `/phone-input` was measured at 4 KB eager with `libphonenumber-js`
  still behind a dynamic import.

## House style for a brand site

Both new apps follow the same shape, and a third should too:

- **URL segments and slugs are English**, never transliterated Serbian:
  `/sr/services/brakes-suspension/`, not `/sr/usluge/kocnice-i-vesanje/`. Build
  every internal href through the app's `PathBuilder` (`src/utils/paths.ts`);
  no page or component writes a locale-prefixed URL by hand.
- **Locale comes from the path**, via `localeFrom(Astro.url.pathname)`. Do not
  use `Astro.currentLocale` (it reads request headers and warns on prerendered
  pages) and do not use `Astro.params` (it is empty on `404.astro`, which would
  serve a Russian 404 to every visitor).
- **`/` redirects, it does not rewrite.** Astro forbids rewriting from an
  on-demand route to a prerendered one, and `src/pages/[locale]/index.astro` is
  prerendered in both new apps — a rewrite returns a 500 for every hit on the
  site root. `src/pages/index.astro` still has to exist with
  `prerender = false` so Vercel routes `/` through middleware at all.
- **`/llms.txt` is served, never redirected.** Each app has both
  `src/pages/llms.txt.ts` (the default locale's copy, at the well-known root
  URI) and `src/pages/[locale]/llms.txt.ts`. Some AI crawlers do not follow
  redirects, and this is the one URI where that risk is not worth taking — so
  the root path must also be listed in the app's unlocalized-path config, or
  middleware 302s it to `/{locale}/llms.txt` in dev and the well-known URI
  stops being one.
- **The lead form carries its own `locale`** in a hidden input. Middleware never
  runs for a prerendered page on Vercel's static output, so the `lang` cookie
  may not exist — without the field, every non-Russian visitor lands on
  `/ru/thanks/` and the lead is stored as `locale: 'ru'`.
- **Only the contact is required**, on all three sites: `@podbor/lead-crm`'s
  form schema accepts an empty `name`, and no form marks it `required`. A
  shorter form converts better, and a lead is answerable without a name. The
  same reasoning removed the service picker from the brand forms. What posts a
  slug now is the page, through a hidden `SERVICE_FIELD` input: the service
  pages, CarLab's cart (`parts-order`) and Details' work pages
  (`servicesApplied[0]`). Everywhere else — the modal, the contact page, the
  homepage forms — a lead carries no service **by design**, and the operator
  card renders `—` for it with the visited page on the `Страница:` line. A
  contact click renders `Клик: <канал>` instead: the click has a channel worth
  naming, a form lead does not. The
  bot cannot set the service afterwards, so treat it as lost rather than
  pending; if per-service numbers ever matter more than the shorter form, the
  fix is to thread the page's service into the modal, not to bring the picker
  back.
- **A messenger tap opens the messenger**, on all three sites. The tile's label
  promises a messenger, so it is a plain `<a>` to one — no modal trigger, works
  with JavaScript off. approved.rs routed these through the lead form until the
  CRO audit priced the detour (issue #56,
  `docs/adr/0015-lead-form-asks-only-for-a-contact.md`); do not re-add it. The
  form keeps its own doors there: the header CTA, the callback control, the
  partner block and the inline form in the same fold. `ContactCTA direct` and
  `BaseLayout directContacts` no longer mean "no modal" — messengers are
  unconditionally direct now — they mean the `/thanks/` carve-out: a phone link
  instead of the callback control, because someone who has just sent a brief is
  not served the form again.
- **Only approved.rs prefills the first message**, `messengerPrefill` in its
  `services.yaml`, so the chat does not open empty. The mechanism is shared and
  the brand sites opt in by passing a message: `telegramLink`/`whatsappLink` in
  `@podbor/site-kit/contact-links` take an optional one and encode it as `text`
  (documented for public username links, unlike `start`, which is bot-only).
  Viber's chat link has no such parameter, so Viber tiles stay bare — asymmetry
  by platform, not by choice.
- **The lead modal takes its service from the trigger.** `data-lead-service` on
  a button sets the form's `service` when the modal opens; `data-default-service`
  on the form is what it resets to when the trigger names none. Both constants
  live in `src/utils/contactChannel.ts`. The second attribute is not redundant:
  for an `<input type="hidden">` the `value` IDL attribute reflects the content
  attribute, so assigning `.value` moves `defaultValue` with it and the slug
  would stick between openings of the same modal.
- **Form controls nest their label** instead of using `id`/`for`. The lead form
  renders two or three times per page (inline, in the modal, on the contact
  page), and duplicate ids make every label focus the first form.
- **Keystatic content paths need the app prefix in production.** GitHub's
  contents API resolves from the repo root, so a collection path is
  `` `${APP_ROOT}src/content/...` `` with
  `const APP_ROOT = import.meta.env.PROD ? 'apps/<app>/' : ''`. Local storage
  mode resolves from the app directory, hence the empty string in dev. The same
  applies to `src/lib/githubContents.ts` in approved-rs.
- Empty content directories need a `.gitkeep` — git does not track them, and
  both the glob loader and the registry test fail on a fresh clone without it.
- **A hand-written translation survives on its own, in its own commit.** The
  translate job compares each string in the file against what the cache says it
  produced; a value that differs was written by a person, so it is adopted and
  served from then on — but only while `translatedFrom` says the file's
  translations were made from the Russian it holds now. That condition is what
  separates a person's edit from stale machine output left behind by a
  reordered list or a chunk that failed last run. The catch is the word _alone_, and it is wider than it
  looks: `translatedFrom` hashes the file's **whole** Russian source, so editing
  any Russian string in a file discards every hand-written translation in that
  file, not only the one whose source moved. Fix translations in one commit and
  Russian in another. The job logs `overwriting hand-written <path>` for each
  dropped translation whose own Russian is unchanged — the one whose Russian you
  just edited is replaced without a line in the log, because there is no cache
  entry under its new key to compare against. An unsafe hand-edit — a dropped `{placeholder}`, a Latin stem on a
  Cyrillic ending, a blank — is refused with a warning; the cached translation
  is served instead, or the string is retranslated if there is none. Adopting
  it would fail the whole-file guard on every subsequent run and wedge the
  pipeline.

## Commands

Run from the repo root — turbo fans them out to every workspace:

```bash
pnpm dev              # turbo run dev (check first if one is already running — see feedback_check_before_dev_server)
pnpm build            # turbo run build → apps/*/dist/
pnpm test             # turbo run test
pnpm typecheck        # turbo run typecheck (astro check: .astro files + zod/TS schemas)
pnpm lint             # eslint . (root, covers all workspaces)
pnpm lint:fix
pnpm format           # prettier --write . (never --write in a review pass — it reformats what you are meant to be reading)
pnpm exec prettier --check .
```

Scoped to one app — either `--filter` from the root, or run inside the app dir:

```bash
pnpm --filter @podbor/approved-rs dev
pnpm --filter @podbor/approved-rs exec vitest run path/to/file.test.ts   # single test file
pnpm --filter @podbor/approved-rs exec vitest run -t "name substring"    # single test by name
```

**The shop funnel walk is local-only and never a CI job.** `pnpm --filter
@podbor/auto-service funnel` drives a browser through card → cart → checkout
against a local Medusa and then reads the Leads and Order markers the system
wrote; it needs the whole backend up and the env exported first. Prerequisites,
assertions and what the layer cannot prove are in
`apps/auto-service/funnel/README.md`. Its specs ride along in the app's existing
`astro check`, which is CI's only involvement — do not add a workflow step and
do not install browser binaries in CI. The four test layers the shop funnel has,
what each one proves, what none of them prove and the standing checklists are in
`docs/guides/shop-funnel-testing.md` — add to a layer there rather than cutting a
fifth seam.

The translate scripts resolve content paths relative to the process's working
directory, so they must run from inside the app:

```bash
cd apps/approved-rs
node --experimental-strip-types scripts/translate-i18n.ts   # i18n YAML (needs OPENAI_API_KEY)
node --experimental-strip-types scripts/translate-cases.ts  # case studies
```

Neither has a dry-run mode: both call OpenAI, rewrite the YAML or the
frontmatter, move `translatedFrom` and write `translations.cache.json`.
Translation belongs to CI — run these locally only to debug the scripts
themselves, and expect a diff to commit or discard afterwards.

Dev-only filesystem code in an SSR route must sit inside an
`if (import.meta.env.DEV)` block with its `node:fs`/`node:path` imports done
dynamically inside it, never as the fall-through of an
`if (import.meta.env.PROD) { … return }` branch. Vite only folds away a
literal `if (false)`, so the fall-through form survives into the bundle, and
`@vercel/nft` then resolves its `process.cwd()` + dynamic path to "every file
under the workspace root" — which the Vercel adapter copies verbatim into the
deployed function (`.git`, `.env*` and every other app included; it was 353 MB
before this was fixed, 32 MB after). See `src/pages/api/admin/case-photos-*.ts`
for the shape.

`pnpm build` may finish rendering every page and only then fail at the
`@astrojs/vercel` "astro:build:done" hook locally with a `sharp` binary `ENOENT`
— that's a local-machine artifact unrelated to code changes, not a real build
failure; check the page-rendering output above it, not the final exit code.

`astro dev` does not put unprefixed `.env` variables into `process.env`, and the
Telegram client reads them from there — so `/api/*` routes fail locally with
"TELEGRAM_BOT_TOKEN is not set" unless the env is exported into the shell first
(`set -a; . apps/approved-rs/.env.local; set +a`). Pre-existing behaviour, not a
monorepo artifact.

Husky + lint-staged run eslint --fix/prettier on staged files on commit — a commit can silently reformat what you staged, so `git status`/`git diff` after committing if that matters.

**Review the diff against this file's conventions before every commit, and
after each significant block of work on a long task.** No exceptions — a typo
and a refactor both go through it. Run whatever review pass your agent offers,
or read the diff yourself against the rules here. Nothing else checks
the diff against these conventions, and it costs minutes against a bug reaching
production. On work
split across several agents or stages, review after each stage lands rather
than once over the combined diff — a diff too large to judge is a review that
finds nothing. This is not enforced by a git hook on purpose: a hook can block
a commit but cannot run the review itself.

## Medusa backend (`apps/medusa`)

Carried over from staywildwear's backend, where each rule cost a bug:

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

## Architecture

**Stack:** Astro v7, `output: 'static'` (prerendered) with the Vercel adapter — most pages are static; a page opts into SSR individually via `export const prerender = false` (used by the two `/api/*` routes and the homepage, which middleware rewrites bare `/` into). There is no global SSR mode.

**i18n routing (`src/middleware.ts` + `src/i18n/`):** 5 locales (`ru` default, `en`, `sr`, `es`, `de`), `routing: 'manual'` in `astro.config.mjs`. The middleware is the single place that: detects locale from cookie/Accept-Language (`detectLocale.ts`, backed by `@podbor/i18n`'s `createLocaleSet`; the five locales are declared once as `localeConfig` in `src/i18n/config.ts`), rewrites bare `/` to the detected locale without a visible redirect, and 301s a long list of legacy pre-i18n slugs (`LEGACY_PATH_REWRITES`, `SLUG_RENAMES`, `moveGermanySpoke`) to their current locale-prefixed URLs. On Vercel's static output, middleware only runs for requests matching a real Astro route — unprefixed paths to real content pages 404 at the edge before reaching it, so `vercel.json` duplicates the same redirects as edge-level static rules for production; `middleware.ts` stays authoritative for local dev and is the source those were hand-derived from. Don't edit one without checking the other.

**Content model — two different systems by design:**

- **Case studies** (`src/content/cases` on approved.rs, `src/content/works` on the two brand sites, schemas in each app's `src/content.config.ts`) are Keystatic-managed Markdown collections. Admin writes `title`/`car`/`price`/etc. and the RU `title`/`body` only; a `translations: { en, sr, es, de }` field on the same entry (not a separate collection) holds the other four locales, each optional — missing/failed falls back to RU rather than breaking the page.
- **UI/site copy** (`src/content/i18n/*.yaml`: `dictionary`, `faq`, `home`, `pages`, `meta`, `leadForm`, `promoBanners`, `services`) is flat YAML, read via `src/i18n/content/*.ts` + a matching `*ContentSchema.ts` (zod), all going through the shared `loadI18nSection()` helper (`src/i18n/loadI18nSection.ts`, a thin binding over `@podbor/i18n`'s `createSectionLoader`) — it parses the YAML once at module load, validates RU against the schema (throws loudly on a bad file instead of failing at render time), and falls back to RU per-locale if a translation fails validation. `getI18n()` (`src/i18n/getI18n.ts`) additionally merges in `src/i18n/dictionaries/templates.ts` — the handful of interpolation functions (e.g. gallery alt-text templates) that can't be represented as static YAML strings.

**Both content systems share one auto-translate mechanism:** admin/dev only ever hand-writes RU. The `translate` job in `.github/workflows/ci.yml` runs each app's `scripts/translate-i18n.ts` plus `scripts/translate-cases.ts` on approved.rs and `scripts/translate-works.ts` on the two brand sites, on every push (any branch, so translations land in a feature branch before merge, not after) and commits the result back. The `translate` job itself stays unconditional rather than path-filtered — every string is looked up in the leaf cache first, so a run with nothing new makes no OpenAI request at all, and every job downstream reads the SHA it left behind, so untranslated content cannot reach production. **Deploy filtering is a separate step** (`scope` in `verify`, against per-app `refs/tags/deployed/<app>` tags) — why: `docs/adr/0008-deploy-only-what-is-stale-in-production.md`. **The unit of work is one string, not one file.** `packages/i18n/src/translate/leafCache.ts` keys a committed cache on the triple (system prompt, model, Russian string), so a rerun asks the model only for the strings whose Russian actually moved — the rest come back from `apps/<app>/src/content/translations.cache.json`. It must stay committed: deleting it regenerates the whole corpus at OpenAI's price. The cache is keyed by file path, so renaming a case directory drops its block and the next run adopts the committed translations as if they were hand-written, which quietly exempts that file from the next prompt fix. Editing the prompt or the model changes the fingerprint and regenerates everything that prompt produced, which is the deliberate switch for a prompt fix. `translatedFrom` still records the hash of the whole RU source, and is what tells the job whether the committed translations correspond to the Russian in the file right now — the condition a hand-written translation is adopted under. Both scripts call through `packages/i18n/src/translate/openaiChat.ts` (official `openai` SDK) and validate the AI's response with `packages/i18n/src/translate/assertSafeTranslation.ts`, which rejects a translation that introduces HTML the RU source didn't already have (a stored-XSS guard on an otherwise-unreviewed auto-commit path — case bodies are rendered as markdown via `src/lib/safeMarked.ts`, which itself sanitizes with `sanitize-html`). Needs `OPENAI_API_KEY` as a GitHub Actions secret (separate from Vercel's env vars); without it the job fails at the translate step but doesn't touch already-translated content.

**Lead capture pipeline (`@podbor/lead-crm`, bound in `src/lib/crm.ts` + `src/lib/crmBot.ts`):** form submissions (`api/leads.ts`) and call-button clicks (`api/contact-click.ts`) both funnel through `notifyLead`, which stores the lead and notifies Telegram via `waitUntil()` (fire-and-forget after the response redirects). Leads live in a single JSON blob on Vercel Blob (`data/leads.json`), not a database — every mutation goes through `updateLeads()`, a compare-and-swap loop with jittered exponential backoff so two concurrent writers (e.g. a bot button edit racing a new form submission) desync instead of retry-colliding. Storage sits behind a `LeadStorage` interface, so moving to Postgres later is one adapter rather than a rewrite. `api/telegram-webhook.ts` handles the bot side (status changes, deal-amount/commission prompts, postpone/remind flow) driven by the same store. `api/reminders.ts` is a Vercel Cron job (needs `CRON_SECRET`) that pushes due `postponed` leads back to the owner.

The binding is split in two on purpose: `src/lib/crm.ts` builds the store and needs no Telegram credentials, while `src/lib/crmBot.ts` builds the bot and reads `TELEGRAM_*` at module load. Importing the store therefore cannot fail a build over a missing bot token. `src/lib/store.ts`, `src/lib/telegram/index.ts` and `src/lib/notifyLead.ts` are thin re-exports over those two.

The commission rate is per business (`DEFAULT_COMMISSION_PERCENT` in `src/lib/crm.ts`), and a lead stores the rate it was created with, so changing the default never rewrites history.

**Keystatic admin (`keystatic.config.ts`):** local dev reads/writes the working tree directly (`storage: { kind: 'local' }`); production (`import.meta.env.PROD`) goes through GitHub's API (`storage: { kind: 'github' }`) since Vercel's filesystem is ephemeral. Service-slug enums are hand-duplicated between `keystatic.config.ts` and `src/content.config.ts`/`src/utils/labels.ts` (`src/utils/services.ts` on the brand sites) because Keystatic's config can't import Astro-coupled modules — and a fourth copy lives in `packages/brands/src/serviceLabels.ts`, which is what the Telegram card reads. `serviceLabel()` echoes an unknown slug rather than throwing, and `serviceLabels.test.ts` hardcodes its own list because a package cannot import an app, so a slug added to an app alone passes every test and reaches the operator raw. Update all of them when adding a service.

**Path/URL construction:** always go through `src/utils/paths.ts`'s `PathBuilder` rather than hand-building locale-prefixed URLs, so a routing change (like the legacy-slug renames above) only needs updating in one place.

See `docs/guides/deploy.md` for the full environment-variable list and Vercel deployment/git.deploymentEnabled setup.

## Project instructions

## i18n

This site supports 5 locales: `ru` (default), `en`, `sr`, `es`, `de`. Translations must always stay complete and in sync across all five.

- Any new user-facing string (page copy, component text, labels, aria-labels, alt text, meta title/description, error messages, etc.) must be added to all five locales at the same time — never RU-only "for now".
- Translations must sound natural in the target language, not literal word-for-word from Russian.
- Serbian needs correct grammatical case agreement (locative/genitive/accusative depending on preposition) — not just vocabulary swapped in.
- Store new strings in the existing i18n structure — `src/content/i18n/*.yaml` (dictionary, faq, home, pages, etc.), validated by the matching schema in `src/i18n/dictionaryContentSchema.ts`/`src/i18n/content/*ContentSchema.ts` and read via `src/i18n/getI18n.ts`/`src/i18n/content/*.ts` — reusing existing keys where possible (DRY) rather than a new inline literal per component. Admin hand-edits only the `ru` fields directly in the YAML; `scripts/translate-i18n.ts` (the `translate` job in `.github/workflows/ci.yml`) auto-fills en/sr/es/de on every push that touches one of those files.
- Before considering any UI change done, verify no hardcoded RU-only text was left behind (e.g. `grep -rP '[а-яА-ЯёЁ]' src/components src/pages src/layouts` outside of comments/intentional RU-only surfaces).
- Case-study content (`src/content/cases`, `src/content/works`) is the one exception to "admin writes it by hand" that still goes through Keystatic: the admin only ever writes the `ru` fields there, and the `translate` job in `.github/workflows/ci.yml` auto-translates en/sr/es/de on every push that touches a case file.

## Analytics

Event names live once in `packages/site-kit/src/goals.ts` and are fired through
`reachGoal` from `@podbor/site-kit/browser`, never as string literals in an app. Every event must also exist as a goal in **all three** Metrika counters —
one created in code but not in a counter is silently lost. The shop funnel
(`add_to_cart`, `begin_checkout`, `order_placed`) is the exception: carlab.rs
only, created when the shop goes live — see `docs/analytics.md`. The vocabulary, the
markup hooks it depends on (`data-lead-form`, `data-contact-channel`,
`data-brand-link`, `aria-invalid`) and how to add one are in `docs/guides/analytics.md`;
whose visits to exclude before drawing any conclusion is in
`docs/guides/analytics-exclusions.md`.

## Validation

Anything that validates data uses **zod** — no hand-rolled `typeof` guards,
regex checks, string slicing or bare `as` casts at a trust boundary. `zod` is
already pinned at the same exact version in `packages/lead-crm`, `packages/i18n`
and all four apps (`apps/medusa` included), and the content-schema loaders (`src/i18n/content/*ContentSchema.ts`
through `createSectionLoader`) are the pattern to copy: `z.object({…}).strict()`,
`parse` where a failure should be loud, `safeParse` where a fallback exists.

Apply it **as you touch code**, not as a separate campaign — rewriting a module
means the module leaves with a schema. The trust boundaries that matter most are
inbound form data, external API and webhook payloads, and environment variables.

One caveat: a module that browser code imports must not pull zod into the client
bundle just to hold an enum. `packages/lead-crm/src/contactChannel.ts` is
deliberately zod-free for that reason and is exported through its own narrow
subpath — put the schema next to such a module, not inside it.

## Dependency versions

Every dependency in `package.json` must be pinned to an exact version — no `^` or `~` ranges. This applies to `dependencies` and `devDependencies` alike.

`pnpm add --save-exact` (or `-e`) does not reliably write an exact version in this repo — confirmed it silently kept the `^` prefix even when passed explicitly (both on a version bump and on a no-op re-add). Don't trust the flag: after adding or updating any package, run `grep '"\^' package.json` and hand-edit any caret left behind before considering the change done.

## Adding dependencies vs. hand-rolling code

This site is Astro SSG (`output: 'static'`/prerendered, no SSR) — `.astro` frontmatter and everything under `scripts/` runs only at `astro build`/Node, never ships to the client bundle. That removes the usual "every dependency costs bundle size" tradeoff for build-time code, so prefer a well-maintained, popular library over a hand-rolled implementation for anything security-sensitive or with known edge cases (HTML sanitization, URL parsing, hashing, retry/backoff against a third-party API, etc.) — a maintained library gets these edge cases right and keeps getting security fixes; a hand-rolled regex/parser has to be re-audited by hand every time. Examples already in this codebase:

- `src/lib/safeMarked.ts` uses `sanitize-html` instead of a custom `marked` renderer + URL-scheme regex — adopted after the regex-based version shipped a protocol-relative-URL bypass that review caught only by hand-testing payloads.
- `scripts/lib/openaiChat.ts` uses the official `openai` SDK instead of a hand-rolled `fetch` wrapper — gets typed errors and automatic retry-with-backoff on 429/5xx for free.

Don't reach for a library reflexively, though — a hand-rolled ~10-line helper that's already correct and purpose-built to one exact call site (e.g. `src/lib/store.ts`'s jittered CAS-retry backoff) doesn't get simpler by wrapping it in a generic library's config API. The bar is: does an existing library solve a real edge case this code either gets wrong today or would have to re-solve by hand, not "is there a package for this."

**No bot framework (grammy/telegraf)** — why: `docs/adr/0006-no-telegram-bot-framework.md`. If the regex chain in `handleCallbackQuery` (`apps/approved-rs/src/pages/api/telegram-webhook.ts`) starts to hurt, the fix is a `[pattern, requiredRole, handler]` table in that file.

This only applies to build-time code (`.astro` frontmatter, `src/lib/`, `scripts/`). Code that ships to the browser (client-side `<script>`, hydrated islands) still carries a real bundle-size cost — weigh a new client dependency normally there.

## Agent skills

### Issue tracker

GitHub Issues in `Zikrasoft/approved_rs`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
