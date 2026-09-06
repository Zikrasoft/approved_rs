# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # astro dev --force (check first if one is already running — see feedback_check_before_dev_server)
pnpm build            # astro build → dist/
pnpm preview          # preview the built output
pnpm test             # vitest run (src/**/*.test.ts + scripts/**/*.test.ts)
pnpm exec vitest run path/to/file.test.ts        # single test file
pnpm exec vitest run -t "test name substring"    # single test by name
pnpm exec astro check # type-check .astro files + the zod/TS schemas
pnpm lint             # eslint .
pnpm lint:fix
pnpm format           # prettier --write . (never --write in a review pass — see review-local skill)
pnpm exec prettier --check .
node --experimental-strip-types scripts/translate-i18n.ts   # dry-run i18n YAML translation (needs OPENAI_API_KEY)
node --experimental-strip-types scripts/translate-cases.ts  # dry-run case-study translation
```

`pnpm build` finishes rendering every page and only then fails at the `@astrojs/vercel` "astro:build:done" hook locally with a `sharp` binary `ENOENT` — that's a local-machine artifact unrelated to code changes, not a real build failure; check the page-rendering output above it, not the final exit code.

Husky + lint-staged run eslint --fix/prettier on staged files on commit — a commit can silently reformat what you staged, so `git status`/`git diff` after committing if that matters.

## Architecture

**Stack:** Astro v7, `output: 'static'` (prerendered) with the Vercel adapter — most pages are static; a page opts into SSR individually via `export const prerender = false` (used by the two `/api/*` routes and the homepage, which needs `Astro.locals.suggestedCountry` from middleware). There is no global SSR mode.

**i18n routing (`src/middleware.ts` + `src/i18n/`):** 5 locales (`ru` default, `en`, `sr`, `es`, `de`), `routing: 'manual'` in `astro.config.mjs`. The middleware is the single place that: detects locale from cookie/Accept-Language (`detectLocale.ts`), rewrites bare `/` to the detected locale without a visible redirect, and 301s a long list of legacy pre-i18n slugs (`LEGACY_PATH_REWRITES`, `SLUG_RENAMES`, `moveGermanySpoke`) to their current locale-prefixed URLs. On Vercel's static output, middleware only runs for requests matching a real Astro route — unprefixed paths to real content pages 404 at the edge before reaching it, so `vercel.json` duplicates the same redirects as edge-level static rules for production; `middleware.ts` stays authoritative for local dev and is the source those were hand-derived from. Don't edit one without checking the other.

**Content model — two different systems by design:**

- **Case studies** (`src/content/{cases,autoservice-cases,detailing-cases}`, schemas in `src/content.config.ts`) are Keystatic-managed Markdown collections. Admin writes `title`/`car`/`price`/etc. and the RU `title`/`body` only; a `translations: { en, sr, es, de }` field on the same entry (not a separate collection) holds the other four locales, each optional — missing/failed falls back to RU rather than breaking the page.
- **UI/site copy** (`src/content/i18n/*.yaml`: `dictionary`, `faq`, `home`, `pages`, `meta`, `leadForm`, `promoBanners`, `services`) is flat YAML, read via `src/i18n/content/*.ts` + a matching `*ContentSchema.ts` (zod), all going through the shared `loadI18nSection()` helper (`src/i18n/loadI18nSection.ts`) — it parses the YAML once at module load, validates RU against the schema (throws loudly on a bad file instead of failing at render time), and falls back to RU per-locale if a translation fails validation. `getI18n()` (`src/i18n/getI18n.ts`) additionally merges in `src/i18n/dictionaries/templates.ts` — the handful of interpolation functions (e.g. gallery alt-text templates) that can't be represented as static YAML strings.

**Both content systems share one auto-translate mechanism:** admin/dev only ever hand-writes RU. `.github/workflows/translate.yml` runs `scripts/translate-cases.ts` and `scripts/translate-i18n.ts` on every push touching the relevant files (any branch, so translations land in a feature branch before merge, not after) and commits the result back. Each script hashes the RU source and stores that hash (`translatedFrom`) alongside the translations, so a rerun only retranslates locales whose RU actually changed — everything else is left untouched. Both call through `scripts/lib/openaiChat.ts` (official `openai` SDK) and validate the AI's response with `scripts/lib/assertSafeTranslation.ts`, which rejects a translation that introduces HTML the RU source didn't already have (a stored-XSS guard on an otherwise-unreviewed auto-commit path — case bodies are rendered as markdown via `src/lib/safeMarked.ts`, which itself sanitizes with `sanitize-html`). Needs `OPENAI_API_KEY` as a GitHub Actions secret (separate from Vercel's env vars); without it the job fails at the translate step but doesn't touch already-translated content.

**Lead capture pipeline (`src/lib/store.ts`, `src/lib/telegram/`, `src/pages/api/`):** form submissions (`api/leads.ts`) and call-button clicks (`api/contact-click.ts`) both funnel through `notifyLead.ts`, which stores the lead and notifies Telegram via `waitUntil()` (fire-and-forget after the response redirects). Leads live in a single JSON blob on Vercel Blob (`data/leads.json`, `src/lib/store.ts`), not a database — every mutation goes through `updateLeads()`, a compare-and-swap loop keyed on the blob's `etag` with jittered exponential backoff (`backoffDelay`) so two concurrent writers (e.g. a bot button edit racing a new form submission) desync instead of retry-colliding. `api/telegram-webhook.ts` handles the bot side (status changes, deal-amount/commission prompts, postpone/remind flow) driven by the same store. `api/reminders.ts` is a Vercel Cron job (needs `CRON_SECRET`) that pushes due `postponed` leads back to the owner.

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
