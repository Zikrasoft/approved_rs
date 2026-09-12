# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm workspace + Turborepo. Apps live in `apps/*`, shared packages in `packages/*`.

```
apps/approved-rs/     the approved.rs site (Astro) — most of this document describes it
apps/detailing/       PRIZMA, the detailing studio site (placeholder brand)
apps/auto-service/    AUTOHUB, the car service site + parts shop (placeholder brand)
packages/lead-crm/    lead store, Telegram bot, and the lead/contact-click routes
packages/i18n/        locale set, YAML/zod section loader, auto-translate runners
packages/site-kit/    brand-agnostic mechanics: safeMarkdown, formatPhone, visitor id
```

Each app owns its own `astro.config.mjs`, `keystatic.config.ts`, `vercel.json`,
`tsconfig.json`, `vitest.config.ts` and `.env*`. Lint/format configs and the
lockfile stay at the repo root and cover every workspace. The root
`vercel.json` exists only to hold `git.deploymentEnabled: false` — Vercel's git
integration looks there, not in the app, and without it every branch push
triggers a failing preview build.

Unqualified paths in this document are relative to `apps/approved-rs/`:
`src/lib/store.ts` means `apps/approved-rs/src/lib/store.ts`.

**Brand names are placeholders.** PRIZMA and AUTOHUB (and their `prizma.rs` /
`autohub.rs` domains) stand in until the client picks real ones. The rule they
have to satisfy: no shared brand root between the three sites, and nothing
carrying Approved's trust/verification semantics.

**One bot, one chat, one lead store, three brands.** Telegram allows a single
webhook URL per bot, so `api/telegram-webhook.ts` and `api/reminders.ts` are
deployed only by `apps/approved-rs`; the other two apps ship just `/api/leads`
and `/api/contact-click`. All three write to the same `data/leads.json` on the
same Vercel Blob store and are separated by the lead's `brand` field, which the
app's `createNotifyLead({ brand })` stamps on — a visitor can never set it.
Connect the same Blob store to all three Vercel projects.

**Cross-site URLs would leak the relationship.** A brand site must never call
another brand's origin from the browser: the request shows up in the network
tab and ties the two together. Each site writes leads through its own
server-side route.

**Why packages exist:** this repo is becoming a portfolio of deliberately
independent brand sites (see `docs/open-questions.md` and the split plan). The
shared code is the machinery — lead capture, i18n — never the visual identity.
Two sites must not be recognizable as relatives from their HTML, so design
systems and components stay per-app on purpose.

**Package rules:**

- Every `packages/*` carries its own test suite at **100% coverage**
  (statements/functions/lines; branches too where achievable). The `test`
  script runs `vitest run --coverage`, so the threshold is enforced by CI
  rather than being decorative.
- Packages are configured per business, never per hardcoded assumption:
  the commission rate, the locale list, the storage key and the service labels
  are all config. Operator-facing Russian bot copy is _not_ — it is the same
  for every brand and lives in the package.
- The app binds a package through a thin re-export file (`src/lib/store.ts`,
  `src/lib/telegram/index.ts`, `src/i18n/config.ts`). That keeps the ~950 lines
  of API-route call sites and ~190 `.astro` i18n call sites free of churn when
  a package's internals move. Wire new packages the same way.
- `packages/site-kit` is mechanics only, never visual. `safeMarkdown` is the
  XSS boundary for auto-translated content, `formatPhone` and the visitor id
  are pure helpers. A component or a design token must not go in here — that is
  exactly what would make two brand sites recognizable as relatives.
- Client-side imports go through a narrow subpath export
  (`@podbor/lead-crm/contact-channel`, `@podbor/site-kit/browser`), never the
  package root: the root barrel pulls zod, date-fns and the Telegram client
  into the browser bundle.

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
- **The lead form carries its own `locale`** in a hidden input. Middleware never
  runs for a prerendered page on Vercel's static output, so the `lang` cookie
  may not exist — without the field, every non-Russian visitor lands on
  `/ru/thanks/` and the lead is stored as `locale: 'ru'`.
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
- After hand-editing any `src/content/i18n/*.yaml`, run
  `node --experimental-strip-types scripts/translate-i18n.ts --record-hashes`.
  Without a current `translatedFrom` hash the next CI translate run hands the
  hand-written Serbian back to the model and commits the result.

## Commands

Run from the repo root — turbo fans them out to every workspace:

```bash
pnpm dev              # turbo run dev (check first if one is already running — see feedback_check_before_dev_server)
pnpm build            # turbo run build → apps/*/dist/
pnpm test             # turbo run test
pnpm typecheck        # turbo run typecheck (astro check: .astro files + zod/TS schemas)
pnpm lint             # eslint . (root, covers all workspaces)
pnpm lint:fix
pnpm format           # prettier --write . (never --write in a review pass — see review-local skill)
pnpm exec prettier --check .
```

Scoped to one app — either `--filter` from the root, or run inside the app dir:

```bash
pnpm --filter @podbor/approved-rs dev
pnpm --filter @podbor/approved-rs exec vitest run path/to/file.test.ts   # single test file
pnpm --filter @podbor/approved-rs exec vitest run -t "name substring"    # single test by name
```

The translate scripts resolve content paths relative to the process's working
directory, so they must run from inside the app:

```bash
cd apps/approved-rs
node --experimental-strip-types scripts/translate-i18n.ts   # dry-run i18n YAML translation (needs OPENAI_API_KEY)
node --experimental-strip-types scripts/translate-cases.ts  # dry-run case-study translation
```

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

## Architecture

**Stack:** Astro v7, `output: 'static'` (prerendered) with the Vercel adapter — most pages are static; a page opts into SSR individually via `export const prerender = false` (used by the two `/api/*` routes and the homepage, which needs `Astro.locals.suggestedCountry` from middleware). There is no global SSR mode.

**i18n routing (`src/middleware.ts` + `src/i18n/`):** 5 locales (`ru` default, `en`, `sr`, `es`, `de`), `routing: 'manual'` in `astro.config.mjs`. The middleware is the single place that: detects locale from cookie/Accept-Language (`detectLocale.ts`, backed by `@podbor/i18n`'s `createLocaleSet`; the five locales are declared once as `localeConfig` in `src/i18n/config.ts`), rewrites bare `/` to the detected locale without a visible redirect, and 301s a long list of legacy pre-i18n slugs (`LEGACY_PATH_REWRITES`, `SLUG_RENAMES`, `moveGermanySpoke`) to their current locale-prefixed URLs. On Vercel's static output, middleware only runs for requests matching a real Astro route — unprefixed paths to real content pages 404 at the edge before reaching it, so `vercel.json` duplicates the same redirects as edge-level static rules for production; `middleware.ts` stays authoritative for local dev and is the source those were hand-derived from. Don't edit one without checking the other.

**Content model — two different systems by design:**

- **Case studies** (`src/content/{cases,autoservice-cases,detailing-cases}`, schemas in `src/content.config.ts`) are Keystatic-managed Markdown collections. Admin writes `title`/`car`/`price`/etc. and the RU `title`/`body` only; a `translations: { en, sr, es, de }` field on the same entry (not a separate collection) holds the other four locales, each optional — missing/failed falls back to RU rather than breaking the page.
- **UI/site copy** (`src/content/i18n/*.yaml`: `dictionary`, `faq`, `home`, `pages`, `meta`, `leadForm`, `promoBanners`, `services`) is flat YAML, read via `src/i18n/content/*.ts` + a matching `*ContentSchema.ts` (zod), all going through the shared `loadI18nSection()` helper (`src/i18n/loadI18nSection.ts`, a thin binding over `@podbor/i18n`'s `createSectionLoader`) — it parses the YAML once at module load, validates RU against the schema (throws loudly on a bad file instead of failing at render time), and falls back to RU per-locale if a translation fails validation. `getI18n()` (`src/i18n/getI18n.ts`) additionally merges in `src/i18n/dictionaries/templates.ts` — the handful of interpolation functions (e.g. gallery alt-text templates) that can't be represented as static YAML strings.

**Both content systems share one auto-translate mechanism:** admin/dev only ever hand-writes RU. `.github/workflows/translate.yml` runs `scripts/translate-cases.ts` and `scripts/translate-i18n.ts` on every push touching the relevant files (any branch, so translations land in a feature branch before merge, not after) and commits the result back. Each script hashes the RU source and stores that hash (`translatedFrom`) alongside the translations, so a rerun only retranslates locales whose RU actually changed — everything else is left untouched. Both call through `scripts/lib/openaiChat.ts` (official `openai` SDK) and validate the AI's response with `scripts/lib/assertSafeTranslation.ts`, which rejects a translation that introduces HTML the RU source didn't already have (a stored-XSS guard on an otherwise-unreviewed auto-commit path — case bodies are rendered as markdown via `src/lib/safeMarked.ts`, which itself sanitizes with `sanitize-html`). Needs `OPENAI_API_KEY` as a GitHub Actions secret (separate from Vercel's env vars); without it the job fails at the translate step but doesn't touch already-translated content.

**Lead capture pipeline (`@podbor/lead-crm`, bound in `src/lib/crm.ts` + `src/lib/crmBot.ts`):** form submissions (`api/leads.ts`) and call-button clicks (`api/contact-click.ts`) both funnel through `notifyLead`, which stores the lead and notifies Telegram via `waitUntil()` (fire-and-forget after the response redirects). Leads live in a single JSON blob on Vercel Blob (`data/leads.json`), not a database — every mutation goes through `updateLeads()`, a compare-and-swap loop with jittered exponential backoff so two concurrent writers (e.g. a bot button edit racing a new form submission) desync instead of retry-colliding. Storage sits behind a `LeadStorage` interface, so moving to Postgres later is one adapter rather than a rewrite. `api/telegram-webhook.ts` handles the bot side (status changes, deal-amount/commission prompts, postpone/remind flow) driven by the same store. `api/reminders.ts` is a Vercel Cron job (needs `CRON_SECRET`) that pushes due `postponed` leads back to the owner.

The binding is split in two on purpose: `src/lib/crm.ts` builds the store and needs no Telegram credentials, while `src/lib/crmBot.ts` builds the bot and reads `TELEGRAM_*` at module load. Importing the store therefore cannot fail a build over a missing bot token. `src/lib/store.ts`, `src/lib/telegram/index.ts` and `src/lib/notifyLead.ts` are thin re-exports over those two.

The commission rate is per business (`DEFAULT_COMMISSION_PERCENT` in `src/lib/crm.ts`), and a lead stores the rate it was created with, so changing the default never rewrites history.

**Keystatic admin (`keystatic.config.ts`):** local dev reads/writes the working tree directly (`storage: { kind: 'local' }`); production (`import.meta.env.PROD`) goes through GitHub's API (`storage: { kind: 'github' }`) since Vercel's filesystem is ephemeral. Service-slug enums are hand-duplicated between `keystatic.config.ts` and `src/content.config.ts`/`src/utils/labels.ts` because Keystatic's config can't import Astro-coupled modules — keep both in sync when adding a service.

**Path/URL construction:** always go through `src/utils/paths.ts`'s `PathBuilder` rather than hand-building locale-prefixed URLs, so a routing change (like the legacy-slug renames above) only needs updating in one place.

See `docs/deploy.md` for the full environment-variable list and Vercel deployment/git.deploymentEnabled setup.

## Project instructions

## i18n

This site supports 5 locales: `ru` (default), `en`, `sr`, `es`, `de`. Translations must always stay complete and in sync across all five.

- Any new user-facing string (page copy, component text, labels, aria-labels, alt text, meta title/description, error messages, etc.) must be added to all five locales at the same time — never RU-only "for now".
- Translations must sound natural in the target language, not literal word-for-word from Russian.
- Serbian needs correct grammatical case agreement (locative/genitive/accusative depending on preposition) — not just vocabulary swapped in.
- Store new strings in the existing i18n structure — `src/content/i18n/*.yaml` (dictionary, faq, home, pages, etc.), validated by the matching schema in `src/i18n/dictionaryContentSchema.ts`/`src/i18n/content/*ContentSchema.ts` and read via `src/i18n/getI18n.ts`/`src/i18n/content/*.ts` — reusing existing keys where possible (DRY) rather than a new inline literal per component. Admin hand-edits only the `ru` fields directly in the YAML; `scripts/translate-i18n.ts` (`.github/workflows/translate.yml`) auto-fills en/sr/es/de on every push that touches one of those files.
- Before considering any UI change done, verify no hardcoded RU-only text was left behind (e.g. `grep -rP '[а-яА-ЯёЁ]' src/components src/pages src/layouts` outside of comments/intentional RU-only surfaces).
- Case-study content (`src/content/{cases,autoservice-cases,detailing-cases}`) is the one exception to "admin writes it by hand" that still goes through Keystatic: the admin only ever writes the `ru` fields there, and `.github/workflows/translate.yml` auto-translates en/sr/es/de on every push that touches a case file.

## Dependency versions

Every dependency in `package.json` must be pinned to an exact version — no `^` or `~` ranges. This applies to `dependencies` and `devDependencies` alike.

`pnpm add --save-exact` (or `-e`) does not reliably write an exact version in this repo — confirmed it silently kept the `^` prefix even when passed explicitly (both on a version bump and on a no-op re-add). Don't trust the flag: after adding or updating any package, run `grep '"\^' package.json` and hand-edit any caret left behind before considering the change done.

## Adding dependencies vs. hand-rolling code

This site is Astro SSG (`output: 'static'`/prerendered, no SSR) — `.astro` frontmatter and everything under `scripts/` runs only at `astro build`/Node, never ships to the client bundle. That removes the usual "every dependency costs bundle size" tradeoff for build-time code, so prefer a well-maintained, popular library over a hand-rolled implementation for anything security-sensitive or with known edge cases (HTML sanitization, URL parsing, hashing, retry/backoff against a third-party API, etc.) — a maintained library gets these edge cases right and keeps getting security fixes; a hand-rolled regex/parser has to be re-audited by hand every time. Examples already in this codebase:

- `src/lib/safeMarked.ts` uses `sanitize-html` instead of a custom `marked` renderer + URL-scheme regex — adopted after the regex-based version shipped a protocol-relative-URL bypass that review caught only by hand-testing payloads.
- `scripts/lib/openaiChat.ts` uses the official `openai` SDK instead of a hand-rolled `fetch` wrapper — gets typed errors and automatic retry-with-backoff on 429/5xx for free.

Don't reach for a library reflexively, though — a hand-rolled ~10-line helper that's already correct and purpose-built to one exact call site (e.g. `src/lib/store.ts`'s jittered CAS-retry backoff) doesn't get simpler by wrapping it in a generic library's config API, and a bot-framework library (grammy/telegraf) would be over-engineering for `src/lib/telegram/client.ts`'s handful of one-way notification calls. The bar is: does an existing library solve a real edge case this code either gets wrong today or would have to re-solve by hand, not "is there a package for this."

This only applies to build-time code (`.astro` frontmatter, `src/lib/`, `scripts/`). Code that ships to the browser (client-side `<script>`, hydrated islands) still carries a real bundle-size cost — weigh a new client dependency normally there.
