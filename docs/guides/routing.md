# Routing: URLs, locales and redirects

Unqualified paths are relative to `apps/approved-rs/`.

## House style

All three sites follow it:

- **URL segments and slugs are English**, never transliterated Serbian:
  `/sr/services/brakes-suspension/`, not `/sr/usluge/kocnice-i-vesanje/`. Build
  every internal href through the app's `PathBuilder` (`src/utils/paths.ts`),
  so a routing change (like the legacy-slug renames below) only needs updating
  in one place; no page or component writes a locale-prefixed URL by hand.
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

## Source locale and primary locale

**`SOURCE_LOCALE = 'ru'` in `packages/i18n` is a deliberate exception** to the AGENTS.md package rule that packages are
configured per business. It is the language content is authored in, not a locale a site serves,
and the whole auto-translate pipeline is built on every app writing Russian and
the `translate` job filling the rest. `createLocaleSet` throws if `'ru'` is
missing from the locale list. Which locale a site _presents_ by default is a
separate, per-app field — `primaryLocale`, required, driving `x-default` and
the `detectLocale` fallback. Do not conflate the two: swapping them silently
renders Serbian pages in Russian, and no test catches it. A future brand that
authors in another language turns `SOURCE_LOCALE` into config; until one
exists, that would be configuration for a single caller.

## i18n routing on approved.rs

**i18n routing (`src/middleware.ts` + `src/i18n/`):** 5 locales (`ru` default, `en`, `sr`, `es`, `de`), `routing: 'manual'` in `astro.config.mjs`. The middleware is the single place that: detects locale from cookie/Accept-Language (`detectLocale.ts`, backed by `@podbor/i18n`'s `createLocaleSet`; the five locales are declared once as `localeConfig` in `src/i18n/config.ts`), rewrites bare `/` to the detected locale without a visible redirect, and 301s legacy URLs through `createRedirectMatcher` from `@podbor/site-kit/redirects`. The rules live once, in `src/redirects.ts`, as Vercel's own `{ source, destination, permanent }` with path-to-regexp sources built from small tables (legacy paths, slug renames × all five locales, the de spoke, buyback countries, moved brand hubs). On Vercel's static output, middleware only runs for requests matching a real Astro route, so the same rules ship to the edge: `vercel.json`'s `redirects` is generated from `EDGE_REDIRECTS` (`REDIRECTS` plus the unprefixed-section catch-alls middleware answers with Accept-Language detection instead) by `node --experimental-strip-types scripts/redirects.ts`, which also writes `headers` from site-kit's `SECURITY_HEADERS`. Never hand-edit either key — `.github/scripts/redirects-drift.sh` regenerates it in `check` and fails on a diff. The two brand sites run the same generator over `unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE)`: a section with a nested builder gets a `/:path*` catch-all, a single page its exact URL with both slash variants — so a new PathBuilder section reaches the edge by regenerating, which is why their `src/utils/paths.ts` imports `../i18n/config.ts` rather than the `@/` alias bare node cannot resolve.
