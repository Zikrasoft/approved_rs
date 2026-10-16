---
status: accepted
---

# Build the new parts catalog custom, not on a commerce platform

Decided 2026-10-16, superseding ADR-0034's "pause" framing with the actual
final word: the Medusa shop is deleted outright, not resumed, and its
replacement is not another commerce platform either.

A survey of five opensource headless commerce platforms (Saleor, Vendure,
Shopware, Sylius, Bagisto) plus the automotive-specific landscape (ACES/PIES,
TecDoc, fitment plugins on Magento/WooCommerce/PrestaShop/BigCommerce, every
dedicated "ETK" project findable on GitHub) found that **none of them model
Fitment or VIN lookup** — general or automotive-specific alike. The one thing
actually worth adopting (manufacturer-verified fitment data) is closed,
commercially licensed data (TecDoc in Europe), not software; every fitment
feature anyone ships, on any platform at any price, is a hand-populated
Year/Make/Model/Engine-to-Part join table. Full findings:
`docs/research/platform-survey.md` (branch `research/platform-survey`).

Vendure was the closest technical fit (same TypeScript runtime as this
monorepo, a clean `OrderItemPriceCalculationStrategy` hook for hiding the
Markup, zero-infra catalog search) but adopting it would repeat the exact
shape of decision this repo already walked back from with `apps/medusa`
(ADR-0034): a full framework, its own admin SPA, worker processes, a GraphQL
surface — for commerce machinery (tax, promotions, multi-currency, B2B) the
settled scope (RSD-only, pickup-only, no B2B) doesn't need, while the one
genuinely hard problem (Fitment) would still need to be built by hand either
way.

**What gets built instead:** plain Postgres tables (Part, Fitment, Supplier,
SupplierOffer, Order — see `GLOSSARY.md`), a self-hosted Typesense or
Meilisearch for catalog search, a small purpose-built staff admin (not a
general commerce admin), and one server-side pricing function that reads a
SupplierOffer and returns `supplierOffer.price * (1 + markupRate)` —
the same ~30 lines every platform's own "exact-fit" extension point would
have called anyway, just without a platform underneath it.

**Reopen this if**: the shop needs real multi-currency, B2B wholesale terms,
or a checkout flow materially more complex than "pick Parts, pay RSD, collect
in-store or pay online, pick up." If that happens, Vendure is the fallback
adopt-one answer, for the reasons above.
