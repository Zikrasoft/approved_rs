---
status: accepted
---

# The storefront is static; the catalog is baked at build and a version stamp drives rebuilds

In `main` since PR #34.

`astro build` reads the Store API once (`src/lib/catalog.ts`); prices are baked, and only cart, stock and checkout call Medusa at runtime. ISR on Vercel is paid, so it was declined. Medusa writes `store.metadata.catalog_version` on every catalog event (product, variant, type, price, translation; not stock or orders), serves it at `GET /store/catalog-version`, and the site publishes the version it baked at `/catalog-version.txt`. CI's `scope` step redeploys auto-service when they differ; `disabled`, a 404 or equality skip, any error deploys. Optionally Medusa dispatches `ci.yml` after a 120 s debounce (off by default, `REBUILD_ON_CATALOG_EVENTS`), so translations arriving after an edit land in the same build.

## Consequences

- A build fails loudly — keeping the previous deploy live — on any network error, a missing RSD region, more than 1000 products (no pagination yet) or an empty catalog. A live deploy therefore depends on Medusa being up; the bypass is `SHOP_STATUS=off` plus a forced deploy.
- The version is read before the products, so an edit during a build leaves the baked version older and triggers another rebuild.
- A product with no RSD price > 0 is skipped with a warning, and landing thresholds count only what survived. A variant is chosen by SKU (= handle upper-cased), else the only variant, else skipped — never `variants[0]`.
- Browser code has no zod: Store API data is rendered with `textContent`, totals come only from Medusa, and checkout refuses when the payment amount differs from the total shown.
