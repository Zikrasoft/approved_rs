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
  prerendered on all three sites, so a rewrite returns a 500 for every hit on
  the site root. `src/pages/index.astro` still has to exist with
  `prerender = false` so `/` reaches the node server and its middleware at all.
- **`/llms.txt` is served, never redirected.** Each app has both
  `src/pages/llms.txt.ts` (the default locale's copy, at the well-known root
  URI) and `src/pages/[locale]/llms.txt.ts`. Some AI crawlers do not follow
  redirects, and this is the one URI where that risk is not worth taking, so
  `createLocaleMiddleware` keeps `/llms.txt` unlocalized for every site.

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

**i18n routing (`src/middleware.ts` + `src/i18n/`):** 5 locales (`ru` default, `en`, `sr`, `es`, `de`), `routing: 'manual'` in `astro.config.mjs`. Every app's middleware is `createLocaleMiddleware` from `@podbor/site-kit/locale-middleware`, the single owner of redirects on all three sites. It passes the unlocalized paths through: the ones every site has (`/api/`, `/keystatic`, `/.well-known/`, `/_astro/`, `/llms.txt`, `/robots.txt`, `/favicon.ico`, `/404`, the sitemaps) live in the module, so a missing hashed asset after a deploy gets a plain 404 rather than a 302 into a locale, and an app passes only its own extras (`/admin/...`, carlab.rs's `/catalogue-build.json`) beside its `localeSet`. It then 301s a path matching one of the app's redirect rules (approved.rs only: `src/redirects.ts`, `{ source, destination }` path-to-regexp rules built from small tables: legacy paths, slug renames × all five locales, the de spoke, buyback countries, moved brand hubs), passes a locale-prefixed path through, and sends anything else to the locale detected from the cookie or Accept-Language (`detectLocale`, backed by `@podbor/i18n`'s `createLocaleSet`) with a 302. Bare `/` gets the same 302 on all three sites: every homepage is prerendered, and Astro cannot rewrite an on-demand route into a prerendered one. `404.astro` is on demand (`prerender = false`) on all three sites: a prerendered 404 is served from disk without middleware, so an unmatched legacy URL would never reach its rule. Caddy serves every file under `dist/client` before node sees the request, so a rule whose source is a built file never fires: `.github/scripts/caddy-split.ts`, which owns that split (a file, a directory's `index.html`, `/_image` answered 404), fails `check` on one.
