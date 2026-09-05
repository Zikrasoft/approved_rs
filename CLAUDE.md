# Project instructions

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
