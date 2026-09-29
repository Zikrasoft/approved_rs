# Every URL is locale-prefixed; legacy URLs 301 forever, from middleware and `vercel.json`

Every page lives under `/{locale}/`, the default included; one template per route is crossed with every locale (`withLocales()`), never copied per language. Astro runs with `routing: 'manual'` and `src/middleware.ts` does locale detection (cookie → Accept-Language → default, via `@podbor/i18n`'s `createLocaleSet`) and every legacy redirect, so a slug rewrite and the locale prefix happen in one 301 instead of two. Astro's built-in prefix routing could not fold the legacy rewrites into the same hop.

The URL scheme moved from country-first transliterated Russian (`/de/autopodbor/`) to locale → service → country with English segments (`/{locale}/vehicle-sourcing/{country}/{city}`). Every old shape keeps a 301 (`LEGACY_PATH_REWRITES`, `SLUG_RENAMES`, `moveGermanySpoke`, `collapseBuybackCountry`) — the redirects protect search rankings and are never removed.

## Consequences

- Serbian uses `sr` (not `rs`, the Serbia country segment) and `sr-Latn-RS` for dates; `/sr/rs/...` reads oddly and was accepted.
