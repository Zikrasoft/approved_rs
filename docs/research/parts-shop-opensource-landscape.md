# VIN parts shop: open-source/ready-made landscape

Research for ticket [#322](https://github.com/Zikrasoft/approved_rs/issues/322)
(part of map [#320](https://github.com/Zikrasoft/approved_rs/issues/320)). Date: 2026-10-16.

**Supersedes** the unmerged `docs/research/platform-survey.md` on branch
`research/platform-survey`, written for the same questions under this map's
earlier issue numbers (#293/#291, now renumbered #322/#320). That pass is
carried forward here, re-verified against primary sources where spot-checked,
plus the one platform it didn't cover — **Spree** — and a stack-grounded
"leaner custom build" section written against this repo's actual
`AGENTS.md`, not assumed.

**Bottom line up front:** nothing changed the prior survey's core conclusion.
No platform — general or automotive-specific — models Fitment or VIN lookup;
every fitment feature anyone ships, at any price point, is a hand-populated
Year/Make/Model/Engine join table, because the only thing worth adopting
(manufacturer-verified fitment data: TecDoc in Europe, ACES/PIES in the US) is
closed, commercially licensed *data*, not software. **Spree is the one
platform that changes the shape of the comparison**: BSD-3-Clause core,
free-tier native multi-vendor marketplace (`seller_id` on `Product`, a real
Vendors API) that maps more directly onto "N suppliers" than anything else
surveyed, first-party **Meilisearch** as a one-line config switch, and a
`rails g spree:admin:scaffold` custom-entity story at least as strong as
Sylius's. It is also a Ruby/Rails backend — a second language/runtime this
all-TypeScript monorepo doesn't otherwise carry — which is the real cost of
adopting it, not its license or features.

Against the owner's "maximize ready-made" directive (#321) and this map's own
standing decision to **prefer whatever admin ships with the chosen platform**
over building one from scratch, the recommendation changes from the prior
pass's "build custom" to: **adopt a platform for Order/checkout/admin/pricing
plumbing, and build only Fitment/VIN custom on top of it** — because this
time the admin-reuse preference is explicit, multi-warehouse/multi-supplier
pricing primitives are explicitly asked about, and Spree's native vendor
model removes a chunk of the custom "SupplierOffer" scaffolding the prior
pass assumed would be hand-built either way. Among adoptable platforms,
**Spree and Vendure are the two live candidates**; the platform pick itself
is correctly left to ticket #329, which this document feeds.

## Source status

- **[P]** — primary source read (repo, official docs, official pricing page,
  `gh api`/LICENSE file).
- **[S]** — secondary source (blog, SaaS vendor page, aggregator) — the claim
  could not be independently verified against a primary source.
- **[NOT VERIFIED]** — flagged explicitly rather than guessed.

---

## 1. Open-source fitment-search + storefront combos

Re-confirms the prior pass's finding — no new candidate surfaced in this pass,
automotive-specific or generic-platform-plus-plugin:

- **Dedicated open-source ETK/catalog projects**: every hit is either
  abandoned (`vehiclefits` org, last touched 2014), a weeks-old solo demo
  with zero community traction, or a from-scratch framework
  (`ronhartman/tecdoc-autoparts-catalog`) that ships no fitment data of its
  own — an empty shell waiting for a feed, not a dataset. **[P]**, re-checked
  this pass, unchanged.
- **Fitment plugins bolted onto general platforms** (Magento Amasty "Product
  Parts Finder", several WooCommerce plugins, PrestaShop "Car/Parts Filter",
  BigCommerce's Convermax): all model fitment identically — a flat
  Year × Make × Model × (Engine) join table, CSV-populated, browsed via
  cascading dropdowns. None do VIN lookup natively; where VIN decode exists
  (Convermax) it's a separately-integrated paid capability on top of the same
  flat table. Nothing here is more capable than a Postgres table and a
  handful of `<select>`s.
- **germsp.ru** remains a UX reference only (VIN-entry → exploded diagram →
  OEM number → cross-reference → multi-tier price/stock), not adoptable
  software — no disclosed data source, as expected for a licensed asset.

**New this pass:** checked Spree's own app store and marketplace docs
explicitly for a fitment/compatibility bolt-on — none exists. Spree's
multi-vendor marketplace (section 2 below) is a closer structural fit for
*suppliers*, but it is not a fitment feature and nobody has wired one to it.

---

## 2. Commerce backend evaluation

### Spot-checks on the prior survey (re-verified this pass)

| Claim (prior survey) | Verified | Source |
|---|---|---|
| Vendure switched to GPLv3 (Community) + a separate Commercial License (VCL) at v3.0 | **Confirmed, verbatim.** `license.md` at tag `v3.0.0`: "available under two different licenses: GNU GPLv3 as Vendure Community Edition / Vendure Commercial License (VCL)... default... without a valid VCL agreement, is the Open-Source GPLv3 license." | [P] `raw.githubusercontent.com/vendure-ecommerce/vendure/v3.0.0/LICENSE.md` |
| Shopware's Collector/Processor is the documented markup-hiding pattern, with I/O forbidden in the processor | **Confirmed.** `CartDataCollectorInterface::collect()` is documented for querying "the database, API endpoints, or fetching data in any other way"; `CartProcessorInterface::process()` docs state it "must not execute queries, as it runs multiple times per request." | [P] developer.shopware.com guides (current URL: `.../checkout/cart/add-cart-processor-collector.html`; the exact path cited in the prior doc 404s today — Shopware reorganized its docs tree, content unchanged) |
| Medusa ships a built-in Search Module, zero extra infrastructure, announced Sept 2026 | **Confirmed, with a correction.** Announced 2026-09-21 (`medusajs.com/blog/announcing-medusa-search`). The self-hosted path is real and free — a first-party `@medusajs/search-postgres` provider, keyword search only, no external service. **But** semantic and hybrid search are advertised as "on all Medusa Cloud plans" — i.e. the fancier half of "Medusa Search" is a managed-cloud feature, not something a self-hosted Vercel-pattern deploy gets for free. The prior doc's "zero extra infrastructure, materially stronger" framing holds for keyword search only; soften the "materially stronger" claim accordingly. | [P] `docs.medusajs.com/resources/infrastructure-modules/search`, `medusajs.com/blog/announcing-medusa-search` |
| NHTSA vPIC is free, well-maintained, but explicitly US/Canada-scoped | **Confirmed.** No key required, up to 140 attributes/VIN, data "provided by manufacturers who make vehicles for sale in the United States," covering vehicles sold in the US since 1981; Canada coverage is a side effect of shared US specs, not a first-class input. | [P] official NHTSA vPIC docs via `vpic.nhtsa.dot.gov` |
| Medusa's Pricing module has no cost/cost-price field; markup has to be hand-built via a Price List job | **Confirmed.** Docs describe Price Sets, Price Lists (conditional grouping) and Price Rules (a rule engine for tiered/contextual pricing) — no cost or cost-price concept anywhere in the module. | [P] `docs.medusajs.com/resources/commerce-modules/pricing` |

Five spot-checks, all held up; one (Medusa Search) needed a cloud-vs-self-hosted
correction. Everything else in the prior survey's Saleor/Vendure/Shopware/
Sylius/Bagisto rows is carried forward unchanged below — it was not
re-re-verified line by line this pass, only these five claims were.

### Spree (new this pass — Ruby on Rails)

- **License [P]:** `LICENSE` file at `github.com/spree/spree` (read via
  `gh api repos/spree/spree/license`) is **BSD-3-Clause**, copyright held by
  "Vendo Sp. z o.o., Vendo Connect Inc." (current/2024-present), "Spark
  Solutions Sp. z o.o." (2015-2024) and the original "Spree Commerce Inc."
  (2007-2015). **Do not confuse "Vendo" (Spree's current commercial owner)
  with "Vendure"** (a separate, unrelated TypeScript project also surveyed
  here) — the names collide by coincidence. The official storefront,
  `spree/storefront` (Next.js), is **MIT**, confirmed from its own GitHub
  description. No feature-gating in the BSD-3 core: confirmed from
  `spreecommerce.org/pricing/` — the free **Community Edition** explicitly
  "covers marketplace (multi-vendor) and B2B capabilities," self-hosted. A
  separately-priced **Enterprise Edition** ("custom pricing," contact-sales,
  no public number) adds multi-tenant *white-label* reselling, Shopify/
  WooCommerce sync, managed private-cloud hosting, SLA support and audit
  trails — none of which CarLab's single-brand, self-hosted scope needs.
- **Fitment:** none, confirmed by an explicit search of Spree's own
  marketplace/extensions ecosystem and web search for an automotive bolt-on —
  same "nobody has built this" result as every other platform surveyed.
- **Multi-warehouse / multi-supplier pricing primitives — this ticket's core
  question for Spree:**
  - **Stock Locations** are native and free: each `Variant` gets a
    `StockItem` per location it's available at; **Stock Reservations** (last
    unit protected at checkout) and **Order Routing** (ranks eligible
    locations, fills from the best fit) ship in the open-source core, not
    gated to Enterprise. [P] `spreecommerce.org/docs/developer/core-concepts/inventory`,
    `spreecommerce.org/stock-reservations-order-routing/`.
  - **Multi-vendor marketplace is free-tier and structurally close to
    "N suppliers."** Products carry a `seller_id`; a product with none is the
    marketplace's own. A **Vendors API**, per-vendor pricing/inventory,
    "multi-vendor checkout with automatic order splitting," and a built-in
    **commission engine** with payouts ship in Community Edition. [P]
    `spreecommerce.org/docs/developer/how-to/build-a-marketplace`,
    `spreecommerce.org/the-ultimate-guide-to-multi-vendor-marketplace-ecommerce/`.
    This is the closest native match to this map's "each supplier/warehouse
    is a row with its own markup %" requirement found anywhere in this
    survey — but the semantics don't line up one-to-one: Spree's vendor model
    assumes the vendor sets *their own* price and the platform skims a
    commission, visible to the vendor. CarLab's model is the owner setting a
    hidden markup over a live Supplier Offer the "vendor" (Intercars,
    CarLab's own warehouse) never sees or prices themselves. Reusing this
    requires inverting who's in control of price, not just wiring up the
    entity.
- **Catalog search vs Typesense/Meilisearch — strongest story in this entire
  survey, Medusa included.** Meilisearch is a first-party, officially
  documented search provider, switched on with one config line
  (`Spree.search_provider = 'Spree::SearchProvider::Meilisearch'`); indexing
  runs in background jobs on product create/update/delete; the Store API
  (`q[search]`, filters, sort) is identical regardless of provider, so there
  is no API-shape cost to switching later. Recommended once a catalog passes
  roughly 1,000 products. [P] `spreecommerce.org/docs/developer/core-concepts/search-filtering`,
  `spreecommerce.org/ecommerce-site-search-meilisearch/`. Typesense itself
  has no first-party Spree adapter — Meilisearch is the precedent, not
  Typesense — but it is the single clearest "this exact kind of self-hosted
  faceted search engine is a first-party, maintained integration" signal
  found anywhere in this research.
- **Admin custom-entity story — corrects the ticket's own framing.** The
  ticket describes Spree's admin as "Rails/ActiveAdmin-descended" — **this is
  stale.** Modern Spree (5.2+) ships its own first-party admin
  (`spree_admin` gem), not ActiveAdmin; ActiveAdmin-integration guides found
  in search results are third-party community tutorials, not how current
  Spree ships. [P] `spreecommerce.org/docs/developer/admin/admin`. Custom
  entities are a one-command scaffold:
  `bin/rails g spree:admin:scaffold Spree::Brand` generates the controller,
  views and routes for an arbitrary new admin-managed model — at least as
  direct as Sylius's hand-documented "Supplier" worked example, and faster.
- **Hiding a Markup:** `cost_price` exists on `Variant` and, per Spree's own
  Storefront API reference for the current version, is **not** among the
  fields the Storefront API returns (`sku`, `price`, `display_price`,
  `weight`/dimensions, `is_master`, `options`, `purchasable`, `in_stock`,
  `backorderable` — no `cost_price`); it only surfaces via the staff-
  authenticated Admin API. This matches every other platform surveyed: a
  cost field exists, kept off the customer-facing API by scope, with no
  documented "fetch live Supplier price, mark it up, write the final price"
  pipeline out of the box — that function still gets hand-written, same as
  on Medusa/Vendure/Shopware/Sylius/Bagisto.
- **Maturity [P]:** 15,759 stars, 5,310 forks (`gh api repos/spree/spree`,
  checked today). `pushed_at` **2026-10-16 — today.** Latest tagged release
  `v5.6.1`, published 2026-07-28. Very actively maintained, with the GitHub
  description itself ("REST APIs, TypeScript SDKs, and production-ready
  Next.js storefront... Zero platform fees") signaling a 2026-era pivot
  toward headless/decoupled usage rather than the Rails-monolith-with-ERB-
  views shape Spree had a decade ago.
- **Fit with this monorepo's stack:** Spree's backend is Ruby/Rails — this
  repo is 100% TypeScript/Node across every app and package. Adopting Spree
  means running and deploying a second language's runtime (a Rails app, its
  own gems, its own test framework, its own deploy target — this repo's
  Vercel/Astro pattern doesn't apply to it at all) purely as an API backend
  consumed by this repo's existing Astro frontend over its Storefront REST
  API. None of `packages/lead-crm`, `packages/i18n` or `packages/site-kit`
  can run inside it or be shared with it — those stay exactly where they are,
  serving the Astro frontend, with Spree reachable only as an HTTP API, the
  same relationship this repo already has with `apps/medusa` today.

### Cross-cutting comparison (carried forward, Spree row added)

| Platform | License (core) | Fitment | Search vs Typesense/Meilisearch | Admin: custom entity w/o fork | Markup-hiding mechanism | Runtime vs this repo |
|---|---|---|---|---|---|---|
| Saleor | BSD-3 [P] | none (1 paid agency bolt-on) | weak — real path is paid Algolia | no (iframe Apps only) | clean (`HANDLE_CHECKOUTS` price override) | Python — foreign |
| Vendure | GPLv3 Core / VCL [P, re-verified] | none | comparable, zero-infra default | yes (plugin + TypeORM) | exact-fit (`OrderItemPriceCalculationStrategy`) | **TypeScript/Node — matches** |
| Shopware | MIT [P] | none (DACH TecDoc agencies, paid) | ES bolt-on, heavier ops | yes (DAL custom entity) | best-documented (Collector/Processor) [P, re-verified] | PHP — foreign |
| Sylius | MIT [P] | none | weakest besides Saleor | yes — official worked example is "Supplier" | least-documented, DIY | PHP — foreign |
| Bagisto | MIT [P] | none | weakest (DB or ES only) | yes (package system) | DIY via custom Product Type | PHP — foreign |
| Medusa | MIT [P] | none | strong self-hosted keyword; semantic/hybrid is Cloud-only [P, corrected] | yes (module system) | DIY via Price List job [P, re-verified] | TypeScript/Node — matches, but a separate app (this repo already tried and paused it, ADR-0034) |
| **Spree** | **BSD-3 core / MIT storefront [P, new]** | none | **first-party Meilisearch, one config line [P, new]** | **yes — `rails g spree:admin:scaffold`, free tier [P, new]** | field exists, kept off Storefront API by scope; no live-feed pipeline out of the box [P, new] | **Ruby/Rails — foreign, and headless-only relative to this repo** |

**What's new in this row that isn't in the others:** Spree is the only
platform in the survey with a **native N-party entity** (`seller_id` /
Vendor) that is free-tier and documented as a first-class marketplace
primitive, not a generic "add a custom model" exercise — and the only one
with a **first-party self-hosted faceted-search engine** (Meilisearch) rather
than "DB search, or pay for/self-host something heavier." Both cut directly
against this ticket's two named evaluation axes (multi-supplier pricing,
Typesense-or-equivalent precedent). The cost is a second language/runtime
this repo has zero existing investment in.

---

## 3. Leaner custom Astro+DB build, evaluated against what this repo actually has

Grounded in `AGENTS.md` at the repo root and a repo grep — not assumed:

- **Typesense is confirmed absent from this repo today.**
  `grep -rli typesense . --exclude-dir=node_modules --exclude-dir=.git`
  returns nothing. "Typesense planned" in this map is a destination, not
  existing integration work to build on — a custom build gets no head start
  here beyond what any platform's search bolt-on would also need: standing
  up a Typesense (or, per the Spree finding above, Meilisearch) instance and
  an indexing job.
- **`packages/shop-catalog` already exists** and already carries exactly the
  shape of helper this ticket is about: `fitment.ts` (+ `fitment.test.ts`),
  `facets.ts`, `money.ts`, `landing.ts`, `registry.ts`, `storeContract.ts`,
  `orderHook.ts` — all currently serving the **paused** `apps/medusa` effort
  per `docs/adr/0034-pause-medusa-deploy-pending-shop-rebuild.md`. A custom
  build reuses this package directly, at 100% as much benefit as a Medusa
  rebuild would, since neither Spree nor Medusa nor any other platform would
  let this package's logic run *inside* them — it stays an app-side
  TypeScript helper library either way.
- **`packages/lead-crm`'s Vercel-Blob compare-and-swap store** (`data/leads.json`,
  jittered-backoff `updateRecords()`) is a real, production-proven
  lightweight persistence pattern — but it is built for an array of Leads
  under moderate write concurrency, not a relational Part/Fitment/Supplier-
  Offer/Order schema with joins, foreign keys and the query shapes a catalog
  needs (filter by make+model+year, join Part→Fitment→SupplierOffer). Reusing
  its *pattern* (CAS loop, backoff) for a future Order-write path is
  plausible; reusing its *storage* (one Blob, one JSON array) for the
  catalog itself is not — this repo has no Postgres today, and a custom
  build's first real new piece of infrastructure, same as any platform
  option, is a real database.
- **`packages/i18n`'s `createSectionLoader`/YAML pattern** covers UI-copy
  translation (dictionary/FAQ/meta strings) well, and would cover the shop's
  static copy the same way `apps/auto-service` already does today. It does
  **not** cover per-Part localized titles/descriptions at catalog scale (a
  Part's name isn't a hand-authored YAML key) — that's a database-column
  translation problem (ru authored, en/sr generated), structurally different
  from the YAML-section model and not something any platform surveyed solves
  either (Saleor/Shopware/Spree all leave it to translation extensions or
  hand-rolled i18n columns).
- **`packages/site-kit`'s mechanics** (contact-control, visitor id, funnel
  tracking, `bootSiteKit`) are front-end/lead-pipeline concerns that attach
  to *any* backend choice identically — a custom build gets no more or less
  from them than a Spree- or Medusa-backed build would, since none of the
  platforms touch lead capture at all.
- **The Astro `output: 'static'`/Vercel-adapter pattern itself** is the one
  real constraint a platform choice has to respect: `apps/auto-service`
  already prerenders the shop's static pages and only goes SSR
  (`prerender = false`) per-route. A custom build's "backend" under this
  pattern is realistically a small set of `/api/*` Vercel functions plus a
  managed Postgres (Neon/Supabase/Vercel Postgres) — there is no existing
  example of that shape in this repo today (the one backend this repo runs,
  `apps/medusa`, is a standalone Node server on a Hetzner VPS, not a Vercel
  function), so "custom" is not a smaller operational step than it looks:
  it is new infrastructure either way, just thinner infrastructure than a
  full platform.

**Net:** a custom build reuses `packages/shop-catalog` wholesale and
`packages/i18n`/`packages/site-kit` exactly as much as a platform-backed
build would — it does not reuse `packages/lead-crm`'s storage layer for the
catalog, and it does not avoid standing up a real database or a search
engine. The genuine saving relative to a platform is narrower than the prior
survey framed it: mainly the Order/checkout/promotions/tax machinery a
platform brings that this map's settled scope (RSD-only, pickup-first,
no B2B at launch) doesn't need yet — not the data layer, not the search
engine, not the i18n, which are comparable costs either way.

---

## 4. VIN decoders / fitment-matching engines (flag only — dedicated ticket owns depth)

Unchanged from the prior pass, re-spot-checked for the vPIC claim (section 2
table above):

- **NHTSA vPIC** (`vpic.nhtsa.dot.gov`) — free, no key, ~140 attributes/VIN,
  JSON/XML/CSV. **US/Canada-scoped by construction**: data comes from what
  manufacturers submit for US-market vehicles; Serbia/EU-only trims, engines
  and homologation variants are not in it. [P]
- **`MartinThoma/vin_decoder`** and similar — ISO 3779/3780 *structural*
  decode only (WMI/VDS/VIS split, check digit); cannot map a VIN to
  make/model/engine, because that mapping is manufacturer-proprietary and
  not published as an open dataset anywhere. [P]
- **TecDoc/TecAlliance** — the closed, commercially-licensed European
  aftermarket reference catalog; almost certainly what Inter Cars RS's own
  "E-katalog" (`rs.intercars.eu/e-katalog`, VIN-and-catalog-number search,
  web + native apps) runs on. Worth raising directly with Inter Cars as a
  reseller data-access question — flagged on the map as a separate "Inter
  Cars RS's real data-access terms" item, not re-litigated here.
- **ACES/PIES** (US Auto Care Association/SEMA) — US/Canada/Mexico-scoped
  data standards, not applicable to a Serbian shop; the one open tooling
  project found (`Faizan-Rao/aces-pies`) is a 1-star solo XML parser, useless
  without the gated reference data regardless.
- **Commercial VIN-decode APIs** (CarsXE, Vehicle Databases, an Apify-hosted
  decoder sourcing from autoref.eu, ~$1.50/1,000 VINs) — cheap enough at
  CarLab's volume to be a viable non-free building block, but not evaluated
  further here; this belongs to the dedicated VIN-decode-depth ticket.

None of this changes with Spree's addition to the platform comparison —
VIN decode and fitment-data sourcing are data-licensing questions,
independent of which commerce backend ends up underneath them.

---

## Recommendation

Given the owner's "maximize ready-made, build custom only where nothing
fits" directive (#321) and this map's explicit "prefer the platform's own
admin over building one" standing decision:

1. **Don't build a general commerce platform from scratch.** The prior
   pass's reasoning for this still holds in full: Order/checkout/tax/
   promotions/an admin SPA are solved problems, and every platform surveyed
   — Spree included — still requires hand-building the one hard, valuable
   part (Fitment/VIN matching) regardless of what's underneath it. Nothing
   found in this pass changes that.
2. **Spree and Vendure are the two live "adopt a platform" candidates** to
   carry into #329's platform-choice grilling — not a tie to break here,
   but narrowed from five-plus candidates to two for concrete reasons:
   - **Spree** gives free-tier multi-warehouse (Stock Locations/Reservations/
     Order Routing) and a free-tier multi-party entity (`seller_id`/Vendor)
     that is structurally closer to "N suppliers, each with their own
     markup" than anything else surveyed, plus the strongest self-hosted
     search story (first-party Meilisearch) in the whole comparison — at the
     cost of a Ruby/Rails runtime this all-TypeScript repo has never run,
     reachable only as a headless API the Astro frontend calls.
   - **Vendure** stays the fallback the prior pass named it: same
     TypeScript/Node runtime as every other app and package in this repo,
     an exact-fit pricing-override hook
     (`OrderItemPriceCalculationStrategy`), and a documented custom-entity
     path — at the cost of GPLv3 licensing terms worth a short independent
     legal read (operating it as a backend for CarLab's own storefront very
     likely doesn't trigger GPLv3's distribution clause, per Vendure's own
     blog, but "very likely" is not "confirmed" for a commercial shop).
   This document does not pick between them — that's #329's job, now
   informed by a concrete Spree row that didn't exist before this pass.
3. **The "leaner custom Astro+DB" option is real but narrower than the prior
   survey framed it.** It reuses `packages/shop-catalog` fully and
   `packages/i18n`/`packages/site-kit` exactly as much as a platform-backed
   build would, but it does **not** meaningfully reuse `packages/lead-crm`'s
   storage layer, and it still has to stand up a real Postgres and a search
   engine from zero — the same two pieces of new infrastructure a platform
   choice would also require (a DB, a search index), just without the
   Order/checkout/admin machinery wrapped around them. Keep it as the
   fallback if #329's deeper dive (Intercars API shape, fitment-data
   licensing cost, part-identity model) turns up a reason neither Spree nor
   Vendure actually fits — not as this ticket's own recommendation, since
   the map's own standing decision already prefers reusing a platform's
   admin over building one.
4. **Fitment/VIN stays custom no matter which of the three paths above gets
   picked.** That part of every option is identical: a Part/Fitment/
   SupplierOffer join table and a markup function, hand-built on top of
   whichever base is chosen. This is unaffected by the platform decision and
   is covered by its own dedicated tickets on the map, not duplicated here.
