# Middleware owns every redirect

The sites run on `@astrojs/node` behind Caddy, and Vercel serves nothing. Every redirect now comes from one place: `createLocaleMiddleware` in `@podbor/site-kit/locale-middleware`, which all three apps' `src/middleware.ts` call. Legacy rules (approved.rs's `src/redirects.ts`) answer 301; locale detection for an unprefixed path answers 302. `404.astro` is on demand on all three sites, because node serves a prerendered 404 from disk without running middleware, which is what made an edge copy of the rules necessary before.

## Considered Options

- **Generate the rules into Caddy** (and `vercel.json`), the first shape of this move, never shipped: two copies of the table, a generated Caddy file per site, and a drift check; and the edge answered an unprefixed path with the primary locale while middleware detected it.

## Consequences

- Caddy serves a file before node sees the path, so a rule whose source is a built file never fires. `.github/scripts/redirects-shadowed.ts` fails `check` when one does.
- Caddy still adds the security headers, since static files never reach node: one shared `infra/auto-service-shop/caddy/security-headers.caddy`, generated from site-kit's `SECURITY_HEADERS`.
- An unprefixed legacy path is still matched before locale detection, so it goes to the locale its rule names.

Supersedes the `vercel.json` half of [ADR-0010](0010-locale-prefixed-urls-and-permanent-legacy-redirects.md).
