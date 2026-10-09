# Every URL is locale-prefixed; legacy URLs 301 forever, from middleware and `vercel.json`

Every page lives under `/{locale}/`, the default included; one template per route is crossed with every locale (`withLocales()`), never copied per language. Astro runs with `routing: 'manual'` and `src/middleware.ts` does locale detection (cookie → Accept-Language → default, via `@podbor/i18n`'s `createLocaleSet`) and every legacy redirect, so a slug rewrite and the locale prefix happen in one 301 instead of two. Astro's built-in prefix routing could not fold the legacy rewrites into the same hop.

The URL scheme moved from country-first transliterated Russian (`/de/autopodbor/`) to locale → service → country with English segments (`/{locale}/vehicle-sourcing/{country}/{city}`). Every old shape keeps a 301 — the redirects protect search rankings and are never removed. They live once, as a rule table of Vercel `{ source, destination, permanent }` entries in `apps/approved-rs/src/redirects.ts`, which middleware matches through `createRedirectMatcher` from `@podbor/site-kit/redirects` and `scripts/redirects.ts` writes into `vercel.json`; `.github/scripts/redirects-drift.sh` fails CI when the two disagree.

## Consequences

- An unprefixed legacy path goes to the primary locale in dev too, matching the edge, rather than to the Accept-Language locale: one table cannot serve both, and the edge is what visitors hit. Unprefixed current paths (`/contacts`) still get Accept-Language detection in dev.

- Serbian uses `sr` (not `rs`, the Serbia country segment) and `sr-Latn-RS` for dates; `/sr/rs/...` reads oddly and was accepted.
