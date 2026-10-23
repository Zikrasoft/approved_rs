---
status: accepted
---

# Delete the old Medusa shop entirely, instead of parking it

Decided 2026-10-17. Reverses [ADR-0034](0034-pause-medusa-deploy-pending-shop-rebuild.md)'s
"pause, don't delete" call.

ADR-0034 paused the Medusa-backed parts shop for carlab.rs (catalog, cart,
checkout → Lead, batteries only, no VIN/fitment logic) rather than deleting
it, on the reasoning that the code might still be useful once the real shop
got designed. It now will not be: the owner wants a true clean slate for the
VIN-based rebuild, tracked on the wayfinder map
([#320](https://github.com/Zikrasoft/approved_rs/issues/320)), and asked
twice, explicitly, to delete the old shop (code, infra, the lot), "as if we
were building the shop from zero." Keeping the old implementation around
invited the next person (human or agent) to anchor a new design on it instead
of starting fresh.

**Deleted:** `apps/medusa` (the whole backend), `infra/medusa` (the VPS image,
compose stack, Caddy config, host scripts), `packages/shop-catalog` (store API
contract, battery-spec registry, shape-only fitment, order-hook wiring), the
old shop/cart/checkout surface in `apps/auto-service` (`/shop/`, `/cart/`,
`AddToCart`/`CartButton`/`CheckoutForm`/`ShopGate`/`ProductCard`/`ProductGrid`/
`ShopFilter`/`ShopSearch`, the Pagefind product search index, `shop.yaml`,
`SHOP_STATUS` and every component/page that branched on it), the
`deploy-medusa`/`medusa-image`/`medusa-integration` CI jobs, and the
`docs/guides/medusa.md` and `docs/guides/shop-funnel-testing.md` deep-dive
guides that described them. `apps/auto-service/src/pages/[locale]/parts/`
(the live VIN lead-capture flow that replaced the shop in the nav per
ADR-0034) is untouched: it is not Medusa-related and stays.

**This is not a vote against Medusa as a platform.** The teardown removes an
abandoned implementation that only ever sold batteries with no fitment logic,
not a verdict on the technology. Which platform the new shop runs on
(Medusa, Vendure, Spree, something custom) is a separate, still-open decision
tracked on the wayfinder map
([#329](https://github.com/Zikrasoft/approved_rs/issues/329)), to be made
against whatever the new `Part`/`PartIdentifier`/`SupplierOffer` data model
turns out to need. Medusa remains a fair candidate there.

**What this does not touch:** every ADR stays, including 0016 through 0027
and 0034 themselves: they are historical record of a real decision made at
the time, not a description of live code. `docs/research/vehicles.json` and
the vehicle-naming research stay parked, as ADR-0028 already had them. The
`parts-order` service slug stays recognized (but unlabelled) in
`packages/brands`' `serviceLabel()`, because historical Leads in production
still carry it.
