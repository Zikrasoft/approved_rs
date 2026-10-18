# CarLab parts shop: adopt a platform, or build custom?

Research for ticket [#293](https://github.com/Zikrasoft/approved_rs/issues/293)
(part of map [#291](https://github.com/Zikrasoft/approved_rs/issues/291)). Date: 2026-10-16.

**Question:** which existing opensource (or otherwise adoptable) platform, if
any, gets CarLab closest to a VIN/model-searchable parts catalog, a
dropship/no-local-stock pricing model (live Supplier price + hidden Markup),
an Order+payment flow, and a staff admin for catalog/orders — while staying
flexible enough to extend? Terms (Part, Fitment, Supplier, Supplier Offer,
Markup, Order) follow `GLOSSARY.md`.

**Bottom line up front:** no existing platform models Fitment or VIN lookup —
general and automotive-specific alike. Every fitment feature anyone ships,
on any platform at any price point, is a hand-populated Year/Make/Model/
Engine-to-Part join table, because the one thing worth adopting (manufacturer
-verified fitment data) is closed, commercially licensed data (TecDoc in
Europe, ACES/PIES in the US), not software. Given that, and given this
repo's settled scope (RSD-only, pickup-only, no B2B, modest catalog),
**the recommendation is build custom on a lighter stack**, not adopt a
general commerce platform. Details and the close calls are below.

## Source status

- **[P]** — primary source read (repo, official docs, official pricing page).
- **[S]** — secondary source (blog, SaaS vendor page, aggregator) — the claim
  could not be independently verified against a primary source.
- **[NOT VERIFIED]** — flagged explicitly rather than guessed.

---

## Part 1 — General headless e-commerce platforms

### Saleor (Python/Django + GraphQL)

- **License [P]:** BSD 3-Clause, core and dashboard alike (not MIT, despite
  some secondary sources). No feature-gated CE/EE split — self-hosted code is
  identical to what Saleor Cloud customers run. Paid tier is managed hosting
  only (Select $1,599/mo up to $200k GMV + 0.8% overage, Volume $3,999/mo,
  Enterprise custom).
- **Fitment:** none built in, none in the official App Store. One agency
  ("PartsLogic" by Web Shop Manager) sells a bespoke fitment/search bolt-on
  wired into a Saleor storefront — a paid, custom integration, not an
  installable plugin. Not a real exception.
- **Catalog search vs Typesense/Meilisearch:** weakest of the group. Core
  GraphQL search is Postgres substring/full-text on name+description only —
  no facets. The official first-party upgrade path is the "Search" App, which
  syncs the catalog to **Algolia** — i.e. the recommended fix is a paid SaaS,
  not a self-hostable engine comparable to Typesense/Meilisearch.
- **Admin:** built-in React dashboard, extended only via iframed "Apps" at
  fixed extension points (nav items, menu entries, sidebar widgets). Saleor's
  own docs state there is no way to add new screens/entity types without
  forking or building a separate iframed app. A "Supplier"/"Fitment" entity
  with real CRUD screens is not supported without a fork — the fallback is a
  metadata key-value bag on existing objects, not a real relational entity.
- **Hiding a Markup:** genuinely clean mechanism exists — "custom prices in
  checkout" lets an app with `HANDLE_CHECKOUTS` permission set `price` on a
  checkout line directly; Saleor never sees the Supplier's raw price or the
  markup math, only the final number. `costPrice` exists on
  `ProductVariantChannelListing` but requires `AUTHENTICATED_APP` /
  `AUTHENTICATED_STAFF_USER` — not reachable by an unauthenticated storefront
  query by default.
- **Maturity:** ~23.4k stars, very active (multiple security releases/week).

### Vendure (Node.js/TypeScript + GraphQL)

- **License [P]:** MIT through v2.3; **switched to GPLv3 (Community) + a
  separately-sold Commercial License at v3.0, July 2024.** Not AGPLv3 — no
  "network use counts as distribution" clause. Vendure's own blog states
  operating it as a backend for your own storefront, including custom
  pricing logic, doesn't require publishing your code — get independent legal
  confirmation before relying on that reading, but it matches GPLv3's text.
  Paid plans (Starter €199/mo up to Enterprise €60k+/yr) gate **B2B-only**
  features (company accounts, contract pricing, quote requests, RBAC/audit
  log) — none of which CarLab's settled scope needs. **Core alone is very
  likely sufficient** for a small B2C dropship shop.
- **Fitment:** none built in, none in the 47-plugin official directory or the
  community Pinelab collection. No exception at all — weaker signal than
  even Saleor's thin PartsLogic case.
- **Catalog search vs Typesense/Meilisearch:** best default story of the
  group. `DefaultSearchPlugin` runs on the existing Postgres/MySQL DB with
  zero extra infrastructure and does real facet-value filtering + aggregation
  counts — roughly comparable to Typesense/Meilisearch for a small catalog
  out of the box. An Elasticsearch plugin exists for scale-up, with an
  identical GraphQL schema (zero query changes to switch).
- **Admin:** mid-migration from an Angular Admin UI (EOL July 2026, patches
  only) to a new React-based Dashboard — build against the React one for any
  new project. Custom entities are a first-class, documented pattern: new
  TypeORM entities + resolvers + dashboard extension, shipped as a plugin, no
  fork needed. Custom Fields on existing entities become real typed DB
  columns with a `public` flag controlling Shop-API exposure.
- **Hiding a Markup:** exact-match extension point —
  `OrderItemPriceCalculationStrategy` is documented as "the main extension
  point for custom pricing logic such as customer-specific pricing, tiered
  pricing, or time-based deals" and determines unit price when a line is
  added to an order. Call the Supplier API there, return
  `basePrice + markup`, entirely server-side. **Vendure ships no built-in
  cost-price field at all** — confirmed from source — so a Supplier-cost
  field has to be added as a custom field, explicitly set `public: false` to
  keep it off the Shop API. No accidental leak risk, because there's nothing
  to accidentally leave exposed.
- **Maturity:** ~8.5k stars (smaller community than Saleor), but actively
  maintained at comparable rigor — v3.8.0 shipped Oct 12 2026 with 340 PRs
  from 45 contributors since the previous feature release.

### Shopware 6 (PHP/Symfony)

- **License [P]:** MIT core, no feature-gating. A "Fair Usage Policy" (not a
  license change) requires businesses above **€1M annual GMV** to subscribe
  to a paid plan (Rise/Evolve/Beyond) for Account/Store/support access — the
  source stays MIT either way. Irrelevant at CarLab's scale.
- **Fitment:** no first-party fitment, but a real, named cluster of DACH-
  market TecDoc-integration agencies sell bespoke bolt-ons against Shopware
  specifically (TecGento, a "TecDoc Schnittstelle" plugin from agency BOW,
  others from netzturm.com and enno.dev) — all paid, all third-party, none
  core. Real signal of automotive-market traction in the DACH region, but
  nothing adoptable for free.
- **Catalog search vs Typesense/Meilisearch:** Elasticsearch is a first-party
  official package (`composer require shopware/elasticsearch`), opt-in,
  heavier to self-host than Typesense/Meilisearch (JVM cluster vs a single
  binary). Default (no ES) search is MySQL-level, adequate for a small
  catalog per Shopware's own framing but with no facets/typo-tolerance.
- **Admin:** dedicated Vue.js SPA. Custom entities without forking are a
  confirmed core feature of the Data Abstraction Layer — a plugin-defined
  `EntityDefinition` gets full CRUD, automatically surfaced in the Admin API
  and UI. Directly maps to a Supplier/Fitment entity.
- **Hiding a Markup:** the most explicitly documented, battle-tested pattern
  of the five platforms. A **Collector** does the external API/DB fetch
  (`CartDataCollectorInterface::collect()` — docs explicitly describe
  querying an external API here); a **Processor**
  (`CartProcessorInterface::process()`) reads the collector's cached result
  and computes the final taxed price via `QuantityPriceCalculator`. The docs
  explicitly forbid I/O inside the processor (it runs multiple times per
  request) — exactly the shape of "fetch Supplier price once per cart
  build, apply Markup server-side, customer only ever sees the final price."
  A native `purchasePrices` field exists on the product entity's Admin API;
  its exclusion from the public Store API is inferred from the Admin/Store
  API split, not verbatim-confirmed in docs **[NOT VERIFIED]**.
- **Maturity:** 3,448 GitHub stars — misleadingly low; most of its commercial/
  DACH user base distributes outside the GitHub mirror (3,100+ community
  extensions per its own README). Current release cadence is healthy
  (v6.7.15.1, Oct 2026).

### Sylius (PHP/Symfony)

- **License [P]:** plain MIT across all of core, no feature-gating. Sylius
  Plus is a genuinely separate paid distribution (B2B Suite, Marketplace
  Suite, RBAC, etc. — reported ~€14,900/yr **[S]**), layered on top of a fully
  functional free Community edition.
- **Fitment:** confirmed none, core or plugin. The only automotive-adjacent
  hit is a `car_parts` cosmetic demo-fixture preset — no fitment logic at
  all.
- **Catalog search vs Typesense/Meilisearch:** weakest after Saleor. Core
  ships Doctrine-query grid filters only; Sylius's own docs say to integrate
  Elasticsearch for anything more advanced, via a third-party plugin
  (`BitBagCommerce/SyliusElasticsearchPlugin` is the current maintained one;
  several older forks look abandoned). No native or well-known path to
  Typesense/Meilisearch. Adequate for a small catalog without any bolt-on.
- **Admin:** Symfony/Twig server-rendered (not an SPA), built on a
  Resource+Grid system. Custom entities are not just supported but are the
  **literal official worked example** in Sylius's own docs — "How to add a
  custom model?" uses a Supplier entity, registered as a Sylius Resource with
  its own admin grid. The single most direct hit for CarLab's exact scenario
  in this whole survey, for the admin side specifically.
- **Hiding a Markup:** the least explicitly documented pattern of the five.
  `ProductVariantPriceCalculator` reads a variant's channel-scoped price;
  a `sylius.catalog_promotion.price_calculator` tagged service lets you
  register custom calculators. Architecturally possible via a decorated
  Symfony service, but there's no named, docs-walked-through pattern for a
  live external price feed the way Shopware has. **No cost-price field
  exists in core at all** (confirmed against the API schema) — "never expose
  the markup" has to be built fully from scratch, including the API-Platform
  normalization-group guard that keeps it out of the Shop API. A third-party
  add-on (`Setono/SyliusCostPricePlugin`) exists if a cost field is wanted.
- **Maturity:** 8,557 stars, very current (v2.3.1, Oct 14 2026 — two days
  before this research). Built on API Platform, i.e. headless-first by
  design, which fits a custom VIN-lookup frontend well.

### Bagisto (PHP/Laravel)

- **License [P]:** MIT core, no feature-gating. Paid surfaces (Bagisto Cloud
  hosting, a 100+-addon marketplace for multi-vendor/B2B/RMA/mobile) are
  additive, not re-enabling crippled core features.
- **Fitment:** confirmed none, core or plugin, after an explicit search of
  Webkul's own marketplace. Two real automotive case studies exist (a Toyota
  Thailand parts/accessories store, a Colombian motorcycle-parts store) — both
  are plain catalogs with no fitment feature.
- **Catalog search vs Typesense/Meilisearch:** through 2.4.x, Elasticsearch
  was the only alternative to default DB search. **Bagisto 2.5.0 (Oct 6 2026)** refactored this into an engine-agnostic Strategy+Manager
  architecture with pluggable search engines — but no Typesense or
  Meilisearch provider has been published for it yet, core or community.
  Default search without Elasticsearch has no faceting/typo-tolerance.
  Weakest search story in the survey after Saleor and Sylius.
- **Admin:** Vue.js on a Laravel/Concord modular core. Custom entities via
  the package system are a documented, scaffolded pattern (own migrations,
  admin-menu merge, ACL integration, generator CLI) — confirmed supported,
  no fork needed.
- **Hiding a Markup:** no documented event/hook for "compute price from a
  live external feed at request time." The realistic extension point is a
  custom **Product Type** (each type resolves its own price-resolution/
  indexer class) — heavier-weight than Shopware's Collector/Processor or
  Vendure's strategy class. Cost exposure is confirmed split correctly: the
  customer-facing Shop REST API has no `cost` field (only `price`,
  `specialPrice`, `minimumPrice`, `maximumPrice`); a `cost` field exists only
  on the staff-authenticated GraphQL Admin API.
- **Maturity:** 28,240 stars — highest of every platform in this survey,
  including the automotive-specific candidates below. Last push yesterday
  (Oct 15 2026), latest release Oct 6 2026. Healthy, current.

### Medusa (Node.js/TypeScript) — baseline refresh

Already known from this repo's abandoned `apps/medusa` effort (ADR-0034), so
only what's changed since is noted: Medusa now ships a **built-in Search
Module** (announced Sept 2026) running on local Postgres with facets,
filters and typo-tolerance — zero extra infrastructure, a materially
stronger starting point than Bagisto/Sylius/Saleor. A community
`@rokmohar/medusa-plugin-meilisearch` plugin remains a solid path to a
self-hosted Meilisearch backend if the built-in module isn't enough. Pricing
runs through a Pricing Module (`calculatePrices()`, Price Sets/Lists/Rules);
no `cost` field exists anywhere in it or the Store API, so the documented
pattern — same as everywhere else — is to write the already-marked-up price
into a Price List from a job that reads the live Supplier feed, and never
represent the raw cost at all.

### Cross-cutting comparison

| Platform | License (core)    | Fitment                           | Search vs Typesense/Meilisearch  | Admin: custom entity w/o fork                         | Markup-hiding mechanism                         |
| -------- | ----------------- | --------------------------------- | -------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Saleor   | BSD-3             | none (1 paid agency bolt-on)      | weak — real path is paid Algolia | no (iframe Apps only)                                 | clean (`HANDLE_CHECKOUTS` price override)       |
| Vendure  | GPLv3 (Core free) | none                              | comparable, zero-infra default   | yes (plugin + TypeORM)                                | exact-fit (`OrderItemPriceCalculationStrategy`) |
| Shopware | MIT               | none (DACH TecDoc agencies, paid) | ES bolt-on, heavier ops          | yes (DAL custom entity)                               | best-documented (Collector/Processor)           |
| Sylius   | MIT               | none                              | weakest besides Saleor           | yes — official worked example is literally "Supplier" | least-documented, DIY                           |
| Bagisto  | MIT               | none                              | weakest (DB or ES only)          | yes (package system)                                  | DIY via custom Product Type                     |
| Medusa   | MIT               | none                              | strong, zero-infra built-in      | yes (module system)                                   | DIY via Price List job                          |

**Takeaway:** every platform requires custom work for the two things that
actually matter here — Fitment/VIN and the live-Supplier-price-with-hidden-
Markup pipeline. What differs is how much _other_ machinery (checkout, tax,
promotions, multi-currency, B2B workflows, a full admin SPA) you'd be
adopting along with it, machinery CarLab's settled scope (RSD-only, pickup-
only, no B2B) mostly doesn't need.

---

## Part 2 — Automotive-specific ETK/PIM/fitment tooling

### ACES & PIES (Auto Care Association / SEMA Data Co-op)

Pure data-interchange **standards**, not software: ACES is vehicle-fitment
XML, PIES is product-attribute data. Published and validated by the US Auto
Care Association / SEMA Data Co-op, gated behind paid US trade-association
membership (entry tier ~$2,500/yr), explicitly scoped to vehicles sold in the
**US/Canada/Mexico** market — European trims, engines, and homologation data
aren't in the underlying reference databases (VCdb/PCdb/Qdb/PAdb) at all. The
only open-source tooling found (`Faizan-Rao/aces-pies`, a solo XML parser) has
1 star and a single commit — and is useless without the gated reference data
anyway, since the schema isn't the hard part. **Not applicable to a Serbian
shop sourcing from a European wholesaler.**

### TecDoc / TecAlliance

The European aftermarket reference catalog — almost certainly the data
format underlying Inter Cars RS's own systems (see below). Closed, owned by
TecAlliance GmbH, licensed commercially with volume-based pricing typically
negotiated as a percentage of turnover against an annual minimum — not a
fixed published price. Open-source client/importer projects exist
(`gewebe/TecdocBundle`, `stanislav-web/tecdoc*`) but are all 6–12 years
stale and all require you to already hold a paid TecDoc license — they
solve nothing CarLab doesn't already have to solve by licensing the data
itself. One actively-touched repo, `ronhartman/tecdoc-autoparts-catalog`
(39 stars, pushed June 2026), is a from-scratch "TecDoc alternative" app —
interesting as a reference implementation of catalog data modeling, but it
ships no vehicle/fitment data of its own; you'd still populate it by hand.
One repo (`tecdocSQL/tecdocdatabase1Q2019`) appears to be a leaked TecDoc
data dump — flagged explicitly as **not a legitimate or safe option**.

### VIN decoding

NHTSA's vPIC API is free, well-maintained, and actively used, but is
explicitly a US/Canada-market tool — coverage degrades sharply for European
vehicles. Open-source VIN libraries (e.g. `MartinThoma/vin_decoder`) only do
the ISO 3779/3780 _structural_ decode (check digits, WMI/VDS/VIS split) —
they cannot map a VIN to make/model/engine, because that mapping is
proprietary per-manufacturer and isn't published as an open dataset for any
market. For Serbia/EU, real VIN-to-vehicle decoding realistically needs a
paid API — several commercial providers exist (CarsXE, Vehicle Databases,
an Apify-hosted decoder sourcing from autoref.eu at roughly $1.50 per 1,000
VINs). That per-call price point is cheap enough at CarLab's volume to be a
viable, if non-free, building block.

### Fitment plugins bolted onto general platforms

Every fitment extension found — Magento's Amasty "Product Parts Finder",
several WooCommerce plugins (free and paid), PrestaShop's "Car/Parts Filter"
modules, BigCommerce apps (incl. the cross-platform SaaS Convermax) — models
fitment identically: a flat Year × Make × Model × (Engine) join table mapped
to SKUs, populated by CSV import, browsed via cascading dropdowns. **None of
them do VIN lookup natively** — where VIN decoding exists at all (Convermax),
it's a separately integrated paid capability layered on top of the same
flat table. One genuinely open-source WooCommerce plugin found
(`zeeshanraza-official/wpcalibrate-vehicle-fitment`, GPL-2.0) is one week old
with zero stars — unproven. **This is exactly the shape CarLab would build by
hand with a Postgres table and a handful of `<select>`s — adopting a plugin
buys nothing a day of custom work doesn't also get.**

### Dedicated open-source "auto parts catalog" / "ETK" projects

Searched explicitly on GitHub. Every hit is either (a) over a decade
abandoned (the `vehiclefits` org — a historical multi-repo attempt at exactly
this, Magento/PrestaShop modules included, last touched 2014), or (b) a
few-weeks-old solo/portfolio demo with no community traction
(`khatiaozashvili-92/autoparts`, `saitejreddy749/automotive-parts-
intelligence`), or (c) the from-scratch `ronhartman/tecdoc-autoparts-catalog`
noted above, which is an empty framework waiting for fitment data, not a
dataset. **Nothing adoptable exists in this category.**

### germsp.ru (UX reference, not adoptable software)

Resolves to "Академия BMW," a single-brand (BMW/MINI/Rolls-Royce) official
parts partner, not a general multi-brand ETK — a narrower, easier problem
than CarLab's any-make ambition. Its `/etk` section is genuinely VIN-entry
based ("Введите VIN-код, чтобы получить доступ к каталогу запчастей"),
built on Next.js, with no disclosed data source (expected — that's exactly
the kind of licensed asset suppliers don't advertise). Useful only as a UX
reference for the VIN-entry → catalog → part-detail flow, confirming the
map's own framing of it as such — not as a software candidate.

### Inter Cars RS itself

Confirmed Inter Cars runs its own "E-katalog" (`rs.intercars.eu/e-katalog`)
explicitly advertised as fast VIN-and-catalog-number search, available on
desktop, tablet, and native Android/iOS apps. This strongly implies Inter
Cars' backend already sits on TecDoc-style European fitment data — which
reframes the real question: **CarLab's practical path to VIN fitment is very
likely whatever feed/API access Inter Cars RS grants a reseller, not a
TecDoc license CarLab would hold independently.** This is worth raising
directly with Inter Cars (tracked separately on the map as "Inter Cars RS's
real data-access terms" under Not yet specified) — it may make the whole
Fitment-data question moot if they expose VIN lookup through a B2B API.

---

## Recommendation: build custom on a lighter stack

**Do not adopt a general headless commerce platform. Do not wait on
automotive-specific tooling — none exists in an adoptable state.**

Reasoning:

1. **The hard, valuable part — Fitment and VIN lookup — is absent from every
   candidate**, general or automotive-specific. Adopting Saleor/Vendure/
   Shopware/Sylius/Bagisto buys Order/checkout/tax/promotion machinery for a
   problem CarLab doesn't fully have (RSD-only, pickup-only, no multi-
   currency, no B2B, no delivery) while leaving the one genuinely hard
   problem — mapping a VIN or Y/M/M/E to Parts — exactly as unsolved as it
   would be custom-built, because that's what every fitment plugin surveyed
   does too: a hand-populated join table.
2. **This repo already ran this experiment once.** `apps/medusa` was a
   modular Node/TS headless-commerce framework in the same architectural
   family as Vendure, and it was scrapped (ADR-0034) specifically for being
   overkill against this exact use case. Vendure is technically the closest
   fit of the five surveyed (same TypeScript runtime as the rest of this
   monorepo, a real `OrderItemPriceCalculationStrategy` hook, no leaky
   cost field, zero-infra search comparable to Typesense/Meilisearch) — but
   adopting it repeats the same shape of decision this repo already walked
   back from, for the same reasons: a full NestJS app, worker processes, its
   own DB, an admin dashboard mid-migration between two frontend frameworks,
   and a GraphQL API surface far beyond "catalog + orders for a small
   Serbian shop."
3. **The Markup-hiding requirement needs custom code regardless of
   platform.** Every platform's "exact-fit" mechanism (Shopware's Collector/
   Processor, Vendure's `OrderItemPriceCalculationStrategy`, Saleor's
   checkout-line price override) is a server-side function that calls a
   live Supplier price feed and writes back a marked-up number, nothing more.
   That function is maybe 30 lines regardless of what it's embedded in —
   adopting a platform doesn't shrink it, it just adds a platform underneath
   it.
4. **The admin requirement is explicitly scoped as "a separate staff web
   panel for catalog/orders"** — i.e. a handful of CRUD screens (Parts,
   Fitments, Orders, Supplier-sync status), not a full e-commerce admin
   suite with iframe apps, rule builders, and promotion engines. Sylius's own
   docs literally use "Supplier" as their worked example for adding a custom
   model — which is a tell that this is a small, bounded admin surface, not
   a reason to adopt a 100k-line framework to get it.
5. **Nothing is lost that CarLab's settled scope actually needs.** Multi-
   currency, tax engines, promotions, B2B quoting, abandoned-cart flows,
   PCI-scope payment-provider marketplaces — all things a platform buys you
   — are explicitly out of scope (pickup-only, RSD-only, no delivery, no
   B2B) per the map.

**What "lighter stack" concretely means**, to carry into the architecture
ticket:

- **Catalog/Fitment/Order model:** plain relational tables (Postgres) —
  `Part`, `Fitment` (a Year/Make/Model/Engine-or-VIN join, same shape as
  every plugin surveyed), a `SupplierOffer` cache with a freshness window,
  `Order`. No ORM-framework commitment implied by this research; that's a
  separate implementation decision.
- **Catalog search:** self-host **Typesense or Meilisearch** directly — a
  single binary, no JVM cluster, no Algolia subscription. This is simpler
  ops than every platform surveyed except Vendure's/Medusa's zero-infra
  defaults, and those defaults are themselves not available without
  adopting the whole platform around them.
- **Markup-hiding:** one server-side pricing function —
  `customerPrice(supplierOffer) = supplierOffer.price * (1 + markupRate)` —
  called at quote time and at order-commit time, with the raw Supplier Offer
  price stored only in a staff-facing table, never returned by any
  customer-facing route or stored on the Order in a customer-reachable form.
  This is the same shape as every platform's "exact-fit" mechanism, just
  without the platform.
- **Admin:** a small staff-only panel (CRUD on Part/Fitment/Order/Supplier-
  sync), scoped to exactly what the map asks for — not a general commerce
  admin.
- **Reuse what this repo already has:** `packages/lead-crm`'s Vercel-Blob
  compare-and-swap store is a proven lightweight persistence pattern already
  in production for Leads; `packages/shop-catalog` already exists (currently
  serving the paused Medusa effort) and some of its helpers (e.g.
  `landingSlug`) may carry over once the Order model itself is decided on a
  separate ticket.

If a later ticket on this map (payment processor, Order data-model, hosting)
turns up a reason the balance should tip — e.g. a need for real multi-
warehouse inventory, B2B wholesale terms, or a checkout flow materially more
complex than "pick Parts, pay RSD, collect in-store" — **Vendure is the
fallback adopt-one answer**, for the reasons in its row above. But nothing
found in this survey makes that case today.
