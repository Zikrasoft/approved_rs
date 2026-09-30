---
status: accepted
---

# The shop has three states, and preview is a client-side `?dev=true` gate

In `main` since PR #34.

`SHOP_ENABLED` becomes `SHOP_STATUS: 'off' | 'preview' | 'live'`, a server-only build env validated with zod (in `src/utils/shopStatus.ts`, not `constants.ts`, which ships to the browser); the committed default is `off`, and flipping it in production is a runbook step. `off` builds no shop pages and never calls Medusa. `preview` builds them `noindex`, out of the sitemap and `llms.txt`, hidden behind a «скоро» placeholder unless the visitor opened `?dev=true` — an inline head script stores the flag in localStorage and sets `html[data-dev]` before first paint, and unlayered CSS rules hide `[data-dev-only]`. `live` renders no dev markers at all.

The flag governs what is **built**, never what is served at runtime: `/api/shop-order` is `prerender = false`, so it ships as a live Vercel function in all three states. What keeps it shut is `SHOP_ORDER_HOOK_SECRET` being unset — the route answers 500 «not configured» without it. A `shopBuilt()` gate on the route was considered on issue #65 and declined: the guard already exists.

## Consequences

This is obscurity, not access control: preview HTML is public, just unindexed, and a stranger who knows the flag can place a (preview-marked) order.
