# Every URL is locale-prefixed; legacy URLs 301 forever, from middleware and `vercel.json`

Every page lives under `/{locale}/`, the default included; one template per route is crossed with every locale (`withLocales()`), never copied per language. Astro runs with `routing: 'manual'` and `src/middleware.ts` does locale detection (cookie → Accept-Language → default, via `@podbor/i18n`'s `createLocaleSet`) and every legacy redirect, so a slug rewrite and the locale prefix happen in one 301 instead of two. Astro's built-in prefix routing could not fold the legacy rewrites into the same hop.

The URL scheme moved from country-first transliterated Russian (`/de/autopodbor/`) to locale → service → country with English segments (`/{locale}/vehicle-sourcing/{country}/{city}`). Every old shape keeps a 301 (`LEGACY_PATH_REWRITES`, `SLUG_RENAMES`, `moveGermanySpoke`, `collapseBuybackCountry`) — the redirects protect search rankings and are never removed.

## Consequences

- On Vercel's static output, middleware only runs for paths that match a real route, so an old slug whose page is gone never reaches it. The redirects are hand-copied into `vercel.json` as edge rules; `middleware.ts` stays authoritative for dev and is what `vercel.json` is derived from. Editing one without the other diverges silently.
- Output is `static`; only API routes and a root `index.astro` (`prerender = false`, so Vercel routes `/` through middleware) are on demand. On the brand sites `/` _redirects_: Astro forbids rewriting an on-demand route onto a prerendered one, and a rewrite 500s. approved.rs rewrites `/` onto an on-demand homepage.
- Middleware never runs for prerendered pages in production, so the `lang` cookie may be missing: the lead form carries its own `locale` field, and pages read locale from the path (`localeFrom`), never `Astro.currentLocale` or `Astro.params`.
- `/llms.txt` is served at the root, not redirected, because some AI crawlers do not follow redirects.
- Serbian uses `sr` (not `rs`, the Serbia country segment) and `sr-Latn-RS` for dates; `/sr/rs/...` reads oddly and was accepted.
