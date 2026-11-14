# AGENTS.md

Instructions for any coding agent working in this repository. Claude Code reads
this file directly; other agents pick it up through the same
[AGENTS.md](https://agents.md) convention.

The general rules every change follows, good architecture, SOLID, DRY and
TDD, are in [CODING_STANDARDS.md](CODING_STANDARDS.md). This file holds the
repository-specific ones.

## Monorepo layout

pnpm workspace + Turborepo. Apps live in `apps/*`, shared packages in `packages/*`.

```
apps/approved-rs/     Approved.rs, the approved.rs site (Astro) — most of this document describes it
apps/detailing/       Details, the detailing studio site — details.rs
apps/auto-service/    CarLab, the car service site: carlab.rs
apps/auto-service-shop/     the VIN parts shop backend for carlab.rs: Medusa 2.21.x, CommonJS
infra/auto-service-shop/    its production: image, compose (postgres, typesense, medusa, caddy), host scripts; one VPS, docs/guides/deploy.md
packages/lead-crm/    lead store, Telegram bot, and the lead/contact-click routes
packages/lead-capture/ the capture bots' webhook route: the /start dialog that turns a Telegram tap into a Lead
packages/i18n/        locale set, YAML/zod section loader, auto-translate runners
packages/site-kit/    brand-agnostic mechanics, never anything visual
packages/brands/      the three brands: domains, names, locale mapping, service labels, the shared address
packages/catalog-contract/ what auto-service-shop and the carlab.rs storefront agree on: part numbers, response schemas, attributes, the ambiguity rule (dual ESM/CJS)
```

A package's contents are an `ls` away and go stale in a document, so this lists
jobs rather than files. What an `ls` will not tell you is which **markup
contracts** a package owns, and an app that breaks one fails silently.
**Stamping or renaming a `data-*` hook, class or CSS variable a package reads**
(contact, funnel, search, copy-number, `<lead-form>` hooks, `METRIKA_MASK_CLASS`,
`--cookie-consent-height`): read
[docs/guides/markup-contracts.md](docs/guides/markup-contracts.md). A bar fixed
to the bottom of the screen rises by `--cookie-consent-height`; each app's
`cookieConsentLift.test.ts` counts the spellings.

Each of the three sites owns its own `astro.config.mjs`, `keystatic.config.ts`,
`vercel.json`, `vitest.config.ts` and `tsconfig.json`, and its own `.env*`.
Lint/format configs and the
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

**A `packages/*` change deploys all three sites, and that is the point.** The
deploy filter in `ci.yml` is `turbo --filter="...[<deployed tag>]"` — the
leading dots pull in the dependents of a changed package, so touching
`@podbor/lead-crm` or `@podbor/i18n` marks all three sites stale at once. All
three write the same `data/leads.json` blob, so shipping a changed package to
one site and not the others puts two versions of the lead schema on one file:
one site writes records another cannot parse, and they land in
`data/leads-unreadable.json` for someone to sort out by hand. Nothing else
enforces this — no test and no schema can see a half-deployed package. Do not
narrow that filter to the app directories, and do not move a `deployed/*` tag
forward by hand.

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
  analytics, the visitor id (`getOrCreateVisitorId`, which mirrors it into
  the first-party `visitor_id` cookie the server-rendered VIN search reads,
  and is cleared with it on a refusal), the Ad visit (`rememberAdTouch`),
  contact-click tracking, contact preference and funnel tracking are armed by `bootSiteKit` from `@podbor/site-kit/browser`, called once from
  each app's layout with its `ymCounterId` and
  `analytics: !import.meta.env.DEV`. `bootSiteKit` also registers the
  language-suggestion custom element (`defineLanguageSuggestion`), which keeps
  its own instance state like any other element. No app imports the seven
  parts, so none can arm one twice or forget one. `bootSiteKit` and each
  part guard against being armed twice — a second call that re-attaches
  listeners doubles whatever it counts, silently. A new page-level effect joins
  `bootSiteKit` rather than a layout script. Anything with instance state is
  still a custom element.
- Every `packages/*` carries its own test suite at **100% coverage**
  (statements/functions/lines; branches too where achievable). The `test`
  script runs `vitest run --coverage`, so the threshold is enforced by CI
  rather than being decorative.
- Packages are configured per business, never per hardcoded assumption:
  the locale list, the storage key and the service labels are all config. There
  is no commission rate to configure: the owner states each Payout and the
  system computes nothing (`docs/adr/0032-the-owner-states-the-payout.md`). Owner-facing Russian bot copy is _not_ — it is the same
  for every brand and lives in the package, contact-channel labels included
  (`channelLabel` in `packages/lead-crm/src/channelLabels.ts`, after three
  byte-identical copies of it sat in the apps' `crmBot.ts`).
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
  (`@podbor/lead-crm/contact-channel`, `@podbor/site-kit/browser`), never the
  package root: the root barrel pulls zod, date-fns and the Telegram client
  into the browser bundle.
- **Building a package for `apps/auto-service-shop` (CommonJS), or changing a
  `packages/catalog-contract` response schema:** read
  [docs/guides/packages.md](docs/guides/packages.md).
- **Putting a helper on a lazily-loaded path, or dev-only `node:fs` code in an
  SSR route:** read [docs/guides/bundles.md](docs/guides/bundles.md).

## House style for a brand site

Both new apps follow the same shape, and a third should too. Read the guide
before touching its area:

- **Writing a URL, reading the locale, adding a redirect or a root route (`/`,
  `/llms.txt`), or touching `SOURCE_LOCALE` / `primaryLocale`:** [docs/guides/routing.md](docs/guides/routing.md). Build every
  internal href through the app's `PathBuilder` (`src/utils/paths.ts`).
  `vercel.json`'s `redirects` and `headers` are generated; `.github/scripts/redirects-drift.sh` fails `check` on a hand edit.
- **Rendering a lead form or the lead modal:**
  [docs/guides/lead-forms.md](docs/guides/lead-forms.md).
- **Touching a contact control, `tel:` link, messenger or Telegram tile, or
  `/thanks/`:** [docs/guides/contact-controls.md](docs/guides/contact-controls.md).
  `.github/scripts/contact-placement.ts` enforces placement in `check`;
  `scripts/contact-controls-pass.ts` checks pointer variants locally.
- **Editing content collections, YAML copy, a Keystatic collection or a service
  slug:** [docs/guides/content.md](docs/guides/content.md).
- **Hand-editing a translation, touching `translatedFrom`, the translate cache
  or a translate script:** [docs/guides/translation.md](docs/guides/translation.md).
  Translation belongs to CI.

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
node --experimental-strip-types scripts/layout-shift-pass.ts <base-url> <path>...   # local only: CLS per page (load + scroll down/up) on two desktops and a phone, fails over 0.01
```

Scoped to one app — either `--filter` from the root, or run inside the app dir:

```bash
pnpm --filter @podbor/approved-rs dev
pnpm --filter @podbor/approved-rs exec vitest run path/to/file.test.ts   # single test file
pnpm --filter @podbor/approved-rs exec vitest run -t "name substring"    # single test by name
```

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

## Shop migrations

**Writing or changing a migration in `apps/auto-service-shop`:** read
[docs/guides/shop-migrations.md](docs/guides/shop-migrations.md). Every shop
migration is **additive**; `check` runs `.github/scripts/shop-migration-drift.sh`
and `.github/scripts/shop-migrations-frozen.sh` against the
`apps/auto-service-shop/migrations.sha256` manifest.

## Architecture

**Stack:** Astro v7, `output: 'static'` (prerendered) with the Vercel adapter — most pages are static; a page opts into SSR individually via `export const prerender = false` (used by the two `/api/*` routes and the homepage, which middleware rewrites bare `/` into). There is no global SSR mode.

**Touching lead storage, a lead or contact-click route, the CRM bot, a capture
bot or the reminder cron:** read [docs/guides/lead-crm.md](docs/guides/lead-crm.md).

See `docs/guides/deploy.md` for the full environment-variable list and Vercel deployment/git.deploymentEnabled setup.

## i18n

This site supports 5 locales: `ru` (default), `en`, `sr`, `es`, `de`. Translations must always stay complete and in sync across all five.

- Any new user-facing string (page copy, component text, labels, aria-labels, alt text, meta title/description, error messages, etc.) must be added to all five locales at the same time — never RU-only "for now".
- Translations must sound natural in the target language, not literal word-for-word from Russian.
- Serbian needs correct grammatical case agreement (locative/genitive/accusative depending on preposition) — not just vocabulary swapped in.
- Store new strings in the existing i18n structure — `src/content/i18n/*.yaml` (dictionary, faq, home, pages, etc.), validated by the matching schema in `src/i18n/dictionaryContentSchema.ts`/`src/i18n/content/*ContentSchema.ts` and read via `content(locale)` (`src/i18n/content.ts`, over the `SECTIONS` registry in `src/i18n/sections.ts`) or `src/i18n/getI18n.ts` — reusing existing keys where possible (DRY) rather than a new inline literal per component. Admin hand-edits only the `ru` fields directly in the YAML; `scripts/translate-i18n.ts` (the `translate` job in `.github/workflows/ci.yml`) auto-fills en/sr/es/de on every push that touches one of those files.
- Before considering any UI change done, verify no hardcoded RU-only text was left behind (e.g. `grep -rP '[а-яА-ЯёЁ]' src/components src/pages src/layouts` outside of comments/intentional RU-only surfaces).
- Case-study content (`src/content/cases`, `src/content/works`) is the one exception to "admin writes it by hand" that still goes through Keystatic: the admin only ever writes the `ru` fields there, and the `translate` job in `.github/workflows/ci.yml` auto-translates en/sr/es/de on every push that touches a case file.

## Analytics

Event names live once in `packages/site-kit/src/goals.ts` and are fired through
`reachGoal` from `@podbor/site-kit/browser`, never as string literals in an app.
`reachGoal` reaches GA4 and Yandex Metrika (all three sites, [ADR-0044](docs/adr/0044-yandex-metrika-beside-ga4.md)) and, where a site sets `META_PIXEL_ID`, the Meta Pixel
(standard events only, `META_EVENTS` in `analytics.ts`); carlab.rs additionally
reaches Google Ads conversions where `GOOGLE_ADS_ID`/`GOOGLE_CONVERSION_LABELS`
are set. Every event must also be marked a key event in **all three** GA4
properties — one fired in code but not marked there is silently excluded from
conversion reporting. The shop funnel goals (`add_to_cart`, `begin_checkout`,
`purchase`) are the exception: carlab.rs only, not fired by the offer cart
until the shop opens (ADR-0045); see `docs/guides/analytics.md`. The vocabulary, the
markup hooks it depends on (`data-lead-form`, `data-contact-channel`,
`data-brand-link`, `aria-invalid`) and how to add one are in `docs/guides/analytics.md`;
whose visits to exclude before drawing any conclusion is in
`docs/guides/analytics-exclusions.md`.

## Logs

The shop logs **Events**, one JSON line each, written only through `logEvent`
in `apps/auto-service-shop/src/lib/log-event.ts`, whose types are the whole
vocabulary; carlab.rs sends its server-side Events to the shop through
`reportShopEvent` (`apps/auto-service/src/lib/shopEvents.ts`), on the wire
schema in `@podbor/catalog-contract/events`. No Event field may hold a phone, a
name, a handle, an email, an IP or a full VIN: hash a client or a VIN with
`hashed`/`vinFields`, pass free text through `loggedQuery`. Why, and how the
lines reach Loki and the weekly export: ADR-0057.

## Validation

Anything that validates data uses **zod** — no hand-rolled `typeof` guards,
regex checks, string slicing or bare `as` casts at a trust boundary. `zod` is
already pinned at the same exact version in `packages/lead-crm`, `packages/i18n`
and all three apps, and the content-schema loaders (`src/i18n/content/*ContentSchema.ts`
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

`pnpm add --save-exact` (or `-e`) does not reliably write an exact version in this repo — confirmed it silently kept the `^` prefix even when passed explicitly (both on a version bump and on a no-op re-add). Don't trust the flag; `.github/scripts/pinned-deps.sh` is what catches what it leaves behind, in `check` and on commit.

## Adding dependencies vs. hand-rolling code

This site is Astro SSG (`output: 'static'`/prerendered, no SSR) — `.astro` frontmatter and everything under `scripts/` runs only at `astro build`/Node, never ships to the client bundle. That removes the usual "every dependency costs bundle size" tradeoff for build-time code, so prefer a well-maintained, popular library over a hand-rolled implementation for anything security-sensitive or with known edge cases (HTML sanitization, URL parsing, hashing, retry/backoff against a third-party API, etc.) — a maintained library gets these edge cases right and keeps getting security fixes; a hand-rolled regex/parser has to be re-audited by hand every time. Examples already in this codebase:

- `src/lib/safeMarked.ts` uses `sanitize-html` instead of a custom `marked` renderer + URL-scheme regex — adopted after the regex-based version shipped a protocol-relative-URL bypass that review caught only by hand-testing payloads.
- `packages/i18n/src/translate/openaiChat.ts` uses the official `openai` SDK instead of a hand-rolled `fetch` wrapper — gets typed errors and automatic retry-with-backoff on 429/5xx for free.

Don't reach for a library reflexively, though — a hand-rolled ~10-line helper that's already correct and purpose-built to one exact call site (e.g. `packages/lead-crm/src/storage/retry.ts`'s jittered CAS-retry backoff) doesn't get simpler by wrapping it in a generic library's config API. The bar is: does an existing library solve a real edge case this code either gets wrong today or would have to re-solve by hand, not "is there a package for this."

This only applies to build-time code (`.astro` frontmatter, `src/lib/`, `scripts/`). Code that ships to the browser (client-side `<script>`, hydrated islands) still carries a real bundle-size cost — weigh a new client dependency normally there.

## Agent skills

### Issue tracker

GitHub Issues in `Zikrasoft/approved_rs`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
