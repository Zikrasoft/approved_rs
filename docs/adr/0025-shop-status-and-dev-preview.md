---
status: proposed
---

# The shop has three states, and preview is a client-side `?dev=true` gate

Implemented on branch `feat/carlab-shop`.

`SHOP_ENABLED` becomes `SHOP_STATUS: 'off' | 'preview' | 'live'`, a server-only build env validated with zod (in `src/utils/shopStatus.ts`, not `constants.ts`, which ships to the browser); the committed default is `off`, and flipping it in production is a runbook step. `off` builds no shop pages and never calls Medusa. `preview` builds them `noindex`, out of the sitemap and `llms.txt`, hidden behind a «скоро» placeholder unless the visitor opened `?dev=true` — an inline head script stores the flag in localStorage and sets `html[data-dev]` before first paint, and unlayered CSS rules hide `[data-dev-only]`. `live` renders no dev markers at all.

## Consequences

This is obscurity, not access control: preview HTML is public, just unindexed, and a stranger who knows the flag can place a (preview-marked) order.
