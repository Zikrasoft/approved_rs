# Vendure vs Medusa: the deep dive for the carlab.rs parts shop

Research for ticket [#329](https://github.com/Zikrasoft/approved_rs/issues/329)
(part of map [#320](https://github.com/Zikrasoft/approved_rs/issues/320)). Date: 2026-10-17.

Baseline: `docs/research/parts-shop-opensource-landscape.md` (branch
`research/parts-shop-opensource-landscape`). This file goes deeper on exactly the
two finalists the owner named and does not repeat that survey. Requirements are
taken from map #320, `GLOSSARY.md` + ADR-0035 (branch `docs/part-identity-model`),
`docs/research/intercars-ecat-api.md`, `docs/research/serbia-online-payment-psp.md`,
ADR-0034, ADR-0036 (branch `teardown/old-medusa-shop`) and the old Medusa code
and guide still in `origin/main` history (`apps/medusa`, `infra/medusa`,
`docs/guides/medusa.md`).

Versions evaluated: **Medusa v2.21.2** (released 2026-09-28) and **Vendure v3.8.0**
(released 2026-10-12), both from `gh api .../releases/latest` [P].

## Source status

- **[P]**: primary source read directly (official docs, the repo's own source or
  LICENSE files via `gh api`, official pricing/licensing pages).
- **[S]**: secondary source (vendor marketing case study, blog, search snippet).
  Vendor case studies about their own customers are tagged [S] on purpose.
- **[NOT VERIFIED]**: could not be confirmed; stated as such, not guessed.
- **[INFERENCE]**: my design reading of the primary sources, not something
  either vendor documents.

Doc pages were read through a fetch tool that summarizes; wording quoted from
doc pages is close but re-read the source before quoting it in an ADR. Quotes
from repo files (LICENSE, source code) are verbatim.

## Bottom line up front

**Pick Medusa.** The evidence is not a toss-up, but it is also not a rout: on
most axes the two are at parity, Vendure is genuinely better on three
(per-line price hook, native localization, auto-rendered admin custom fields),
and Medusa wins on the axes this map weights hardest: **Typesense** (owner
mandated by name), **"maximize ready-made"** (more of the plumbing is free and
first-party), **licensing** (no paid tier for anything this shop needs) and
**sunk team knowledge**. The single decisive fact:

> Medusa's open-source Search Module ships a provider interface whose own source
> names Typesense as a target engine, and the module owns index definitions,
> batching, task tracking and reindexing. Vendure sells its Typesense
> integration as a paid feature of the **Growth plan at EUR 599/month**; on the
> free GPLv3 core, Typesense is a search plugin written from scratch.

Details and what would make this the wrong call are in the last section.

## A correction to this ticket's framing first

The task brief says the team "already ran a Medusa backend in production". It
did not. Per map #61 and its tickets, the VPS was never ordered and the first
deploy never happened: [#69 "Order the VPS and bring up api.carlab.rs"](https://github.com/Zikrasoft/approved_rs/issues/69)
and [#71 "Secrets and the first Medusa deploy to the VPS"](https://github.com/Zikrasoft/approved_rs/issues/71)
were both closed as "Superseded ... Closing without implementing" [P]. There is
no `deployed/medusa` tag on the remote (`git ls-remote --tags origin 'deployed/*'`
lists only the three sites) [P].

What the team _does_ have is real, but it is build-and-CI experience, not
production-ops experience:

- A complete Medusa 2.19 backend (`apps/medusa`, ~100 files) with custom admin
  widgets (`src/admin/widgets/product-spec.tsx`, `publish.tsx`), workflow hooks
  (`src/workflows/hooks/complete-cart-guard.ts` on `completeCartWorkflow.hooks.validate`),
  subscribers, scheduled jobs, a zod-backed `query.graph` read layer, and the
  Translation module switched on [P, `origin/main` history].
- A Docker image built and booted to healthy in CI on every push (`medusa-image`
  job), an HTTP integration suite against a dockerized Postgres, and a full
  compose stack in `infra/medusa/docker-compose.yml`: Postgres 16 (512 MB),
  Redis 7 (256 MB), Medusa (1.5 GB limit, `--max-old-space-size=1024`), Caddy in
  front, plus `deploy.sh`/`backup.sh`/`restore.sh`/`harden-ssh.sh` [P].
- One end-to-end local order walk (card, cart, order, bot card) on #83 [P].
- `docs/guides/medusa.md` records the Medusa rules "where each rule cost a bug",
  carried over from an earlier Medusa project (staywildwear) [P].

The known pain points the old guide names are listed under requirement 9.
"Running Medusa (alerts, proving backups restore, VPS down on a Saturday): the
scripts exist; nobody owns them" was an open item on #61 when it closed [P].

---

## Summary table

| #   | Requirement                               | Medusa 2.21                                                                                                                                                     | Vendure 3.8                                                                                                                                            | Edge                                                                     |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | N suppliers, per-supplier markup %        | No supplier primitive. Stock Locations, Price Lists/Rules, marketplace recipe (Vendor module + links). Custom line-item price workflow is an official guide [P] | No supplier primitive. StockLocation/StockLevel, Seller+Channel multi-vendor, `OrderItemPriceCalculationStrategy` per line with line custom fields [P] | **Vendure, slightly** (cleaner live-price hook)                          |
| 2   | Part / PartIdentifier / SupplierOffer fit | Product=Part, Variant=brand-variant, custom modules + `defineLink` for identifiers and offers [P mechanism, INFERENCE mapping]                                  | Same mapping, TypeORM entities in a plugin or `relation` custom fields [P mechanism, INFERENCE mapping]                                                | Parity                                                                   |
| 3   | Typesense                                 | Free first-party provider interface, Typesense named in core source; provider to write; no v2 Typesense package exists [P]                                      | Typesense integration is a **paid Growth-plan feature (EUR 599/mo)**; free path is a custom plugin [P]                                                 | **Medusa, clearly**                                                      |
| 4   | Fitment/VIN custom domain                 | Custom module, isolated tables, link tables, cross-module queries via Query [P]                                                                                 | TypeORM entity in the same schema, plain SQL joins, GraphQL extension [P]                                                                              | **Vendure, slightly** (narrowed if fitment queries go through Typesense) |
| 5   | Admin usable by non-devs                  | Price Lists editable in stock admin; markup and fitment need a UI route/widget [P]                                                                              | Custom fields on core entities auto-render; custom entities need hand-built pages; React dashboard new since 3.5 [P]                                   | **Vendure, slightly** for markup; parity for fitment                     |
| 6   | Payment (CorvusPay / Monri WSPay)         | `AbstractPaymentProvider`, webhook method in the interface; no plugin for either PSP [P]                                                                        | `PaymentMethodHandler`; no plugin for either PSP [P]                                                                                                   | Parity                                                                   |
| 7   | ru/en/sr product content                  | First-party Translation module (since 2.12.3), **still behind a feature flag**, team already used it [P]                                                        | Core-native `Translatable`/`LocaleString`, `localeString` custom fields [P]                                                                            | **Vendure**                                                              |
| 8   | Licensing                                 | MIT except RBAC + SSO (Enterprise, proprietary; not needed at launch) [P]                                                                                       | GPLv3 Core, no obligation for a private backend per Vendure's own FAQ; paid plans carry features, incl. Typesense [P]                                  | **Medusa**                                                               |
| 9   | Ops cost                                  | Server + worker, Postgres + Redis, >= 2 GB RAM; compose stack already written and CI-booted [P]                                                                 | Server + worker, Postgres + Redis (BullMQ), 512 MB min/process; new to the team; no serverless guide [P]                                               | **Medusa, slightly** (known stack; never production-proven)              |
| 10  | Future scale                              | Partbase 500k+ products and Wipertech fitment case studies [S]; several perf issues closed, a few open [P]                                                      | No case study states a SKU count; open N+1 issues [P]                                                                                                  | **Medusa, slightly**                                                     |

---

## 1. N suppliers, per-supplier markup %, admin-editable

**Neither platform has a "supplier with a hidden markup over a live cost feed"
primitive.** Both have multi-warehouse and a multi-vendor marketplace story, and
both marketplace stories assume the vendor sets its own price and sees its own
orders, which is the inverse of CarLab's model (the baseline already flagged
this for Spree; it holds here too).

### Medusa

- **Stock Locations + Inventory**: inventory levels per stock location, stock
  locations linked to sales channels to scope availability [P,
  docs.medusajs.com/resources/commerce-modules/sales-channel/links-to-other-modules].
  `inventory-level.created/updated/deleted` events exist [P, events reference].
- **Pricing**: Price Sets per variant, Price Lists (sale/override, scoped by
  customer group) and Price Rules (attributes like `region.id`,
  `customer.groups.id`, `item_total`, operators `eq`/`gte`/`in`, quantity tiers)
  [P, docs.medusajs.com/resources/commerce-modules/pricing/price-rules]. No cost
  or markup field anywhere (baseline, re-confirmed).
- **Marketplace recipe**: a `marketplace` module with `Vendor`/`VendorAdmin`,
  links `src/links/vendor-product.ts`/`vendor-order.ts`, workflows
  `create-vendor`, `create-vendor-product`, `create-vendor-orders` (splits an
  order per vendor) [P, docs.medusajs.com/resources/recipes/marketplace/examples/vendors].
  This is the closest structural precedent: a custom module holding a
  party entity, linked to core Product/Order. No dropship/supplier example found.
- **Dynamic price at add-to-cart**: official guide "Implement Custom Line Item
  Pricing" [P, docs.medusajs.com/resources/examples/guides/custom-item-price]:
  a custom `addCustomToCartWorkflow` runs `useQueryGraphStep`, a custom price
  step, `acquireLockStep`, then core `addToCartWorkflow` with `unit_price`
  set, exposed as a custom store route. The line item comes back with
  `is_custom_price: true`.
- **Important caveat, read in core source**: on cart refresh, a custom-priced
  line is **not** repriced. In
  `packages/core/core-flows/src/cart/workflows/get-variants-and-items-with-prices.ts`,
  `input.unitPrice = calculatedPriceSet.calculated_amount` runs only
  `if (variant && !isCustomPrice && calculatedPriceSet)` [P]. So the price is
  frozen at add time; if the Intercars cost moves between add-to-cart and
  checkout, our own code must re-check. The natural place is the same hook the
  old code used: `completeCartWorkflow.hooks.validate` [P, old
  `complete-cart-guard.ts`].

**Concrete Medusa shape [INFERENCE]**: module `supplier` with
`model.define("supplier", { name, connector, markup_percent })` and
`model.define("supplier_offer", { supplier_article, cost_amount, currency,
stock_qty, lead_time_days, warehouse_code })`, `defineLink(ProductModule.linkable.productVariant,
{ linkable: SupplierModule.linkable.supplierOffer, isList: true })`; a scheduled
job (`src/jobs/`) pulling Intercars in 100-SKU batches; a custom add-to-cart
workflow taking `offer_id`, pricing `cost * (1 + markup)`, storing `offer_id`
in line item metadata; a `completeCartWorkflow.hooks.validate` re-check.
Optionally the sync job also writes the cheapest offer's sell price into the
variant's Price Set, so catalog listing prices stay native.

### Vendure

- **StockLocation + StockLevel** per variant per location since v2.0;
  `StockLocationStrategy` (`getAvailableStock`, `forAllocation`, `forRelease`,
  `forSale`, `forCancellation`); multiple locations need a custom strategy;
  `StockDisplayStrategy` controls what shoppers see [P,
  docs.vendure.io/guides/core-concepts/stock-control/].
- **Multi-vendor**: `Seller` entity, one Channel per seller, `OrderSellerStrategy`
  (`setOrderLineSellerChannel`, `splitOrder`, `afterSellerOrdersCreated`), a
  `multivendor-plugin` example at `packages/dev-server/example-plugins/multivendor-plugin`
  that the docs call "educational purposes only" [P,
  docs.vendure.io/guides/how-to/multi-vendor-marketplaces/]. Free in Core [P, vendure.io/core].
- **Price hooks**: `OrderItemPriceCalculationStrategy.calculateUnitPrice(ctx,
productVariant, orderLineCustomFields, order, quantity)` [P,
  docs.vendure.io/reference/typescript-api/orders/order-item-price-calculation-strategy/];
  `ProductVariantPriceCalculationStrategy`, `ProductVariantPriceSelectionStrategy`;
  `ProductVariantPrice` carries `customFields` [P, repo source].
- **Why this is the better hook**: the order line's own custom fields reach the
  strategy, so an `OrderLine` custom field `supplierOfferId` set via
  `addItemToOrder(..., customFields)` lets one function price the exact offer
  the customer clicked, live, inside the platform's own pricing pipeline. Whether
  Vendure re-runs this strategy on every order modification (so a moved cost is
  picked up before checkout) is **[NOT VERIFIED]**; it runs at least on add and
  on quantity change per the signature.
- No dropship/supplier plugin found (npm and GitHub search) [P, searched].

**Verdict**: same amount of hand-built domain code on both (a Supplier and a
SupplierOffer entity, a sync job, a pricing function). Vendure's hook is the
more natural seat for "price = this offer's cost times this supplier's markup";
Medusa's needs a custom add-to-cart workflow plus a checkout re-check. Small
edge to Vendure.

## 2. Mapping Part / PartIdentifier / SupplierOffer

ADR-0035: `Part` is never purchasable; each brand-variant (a `PartIdentifier`
of type `oem` or `manufacturer-number`) is a separate purchasable line; each
`SupplierOffer` belongs to one brand-variant and is itself what the customer
picks (supplier, warehouse, lead-time tier, price).

The same mapping works on both [INFERENCE]:

| Domain                                | Medusa                                                                     | Vendure                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Part`                                | `Product` (title/description localized)                                    | `Product`                                                                                    |
| brand-variant                         | `ProductVariant` with a "brand" option                                     | `ProductVariant` with a "brand" option group                                                 |
| `PartIdentifier` (type, brand, value) | custom module model, `defineLink` to variant `isList` (EAN, extra numbers) | plugin `@VendurePlugin({ entities: [PartIdentifier] })`, TypeORM `ManyToOne(ProductVariant)` |
| `SupplierOffer`                       | custom module model, linked to variant `isList`                            | plugin entity, `ManyToOne(ProductVariant)`                                                   |
| `Supplier` + `markup_percent`         | custom module model                                                        | custom entity, or a `markupPercent` custom field on `Seller`/`StockLocation`                 |
| the offer the customer picked         | line item `metadata.offer_id`                                              | `OrderLine` custom field `supplierOfferId`                                                   |

Extension points, concretely:

- **Medusa**: custom modules (`model.define`, own migrations), Module Links
  (`defineLink`, `isList`, extra columns on the link table), workflow hooks
  (`createProductsWorkflow.hooks.productsCreated`, ...) with `additional_data`
  passing request data into hooks [P, docs.medusajs.com/learn/fundamentals/module-links,
  .../workflows/workflow-hooks]. No documented variant count limit; a maintainer
  said in 2023 they had worked with stores of "millions of variants" [P, v1 era,
  github.com/medusajs/medusa/discussions/5443].
- **Vendure**: `CustomFieldConfig` types `string`, `localeString`, `text`,
  `localeText`, `int`, `float`, `boolean`, `datetime`, `relation`, `struct`
  (`struct` since 3.1, relation cascade options since 3.7, custom field indexes
  since 3.8) [P, `packages/core/src/config/custom-field/custom-field-types.ts`];
  plugin entities extending `VendureEntity`; `shopApiExtensions` /
  `adminApiExtensions`; TypeORM migrations [P]. No documented variant limit.

**Verdict: parity.** Medusa keeps our tables in an isolated module (cleaner
boundaries, no cross-module foreign keys); Vendure puts them in the same
TypeORM schema (simpler joins). Which is better depends on requirement 4.

## 3. Typesense

The owner mandated Typesense by name.

### Medusa

- The Search Module (`@medusajs/medusa/search`, default provider
  `@medusajs/search-postgres`) has a pluggable provider class
  `AbstractSearchProviderService` with `search`, `searchMany`, `upsertIndex`,
  `deleteIndex`, `listIndexes`, `upsertDocuments`, `deleteDocuments`,
  `clearIndex` [P, `packages/core/utils/src/search/abstract-search-provider.ts`].
  Its own doc comment, verbatim: "A search provider translates the Search
  Module's provider-agnostic input into the calls of a search engine, such as
  Meilisearch or Typesense ... The Search Module owns everything around it,
  including index definitions, batching, task tracking, and reindexing." And in
  `packages/core/types/src/search/common.ts`: "others, such as PostgreSQL and
  Typesense, apply it inline" [P].
- Index definitions declare an entity, its fields, a seed and the events that
  keep it current; the module creates/migrates indexes and fills them when empty
  [P, docs.medusajs.com/resources/infrastructure-modules/search]. The framework
  is in the MIT part of the repo (not in `ENTERPRISE-LICENSE.md`) [P].
- **No Typesense provider package exists**: `packages/modules/providers` lists
  16 providers, the only search one is `search-postgres` [P]. The only
  community plugin, `ybirader/medusa-plugin-typesense` (0.0.1, last touched
  2024-03, 12 stars), is v1-era [P]. npm search "medusa typesense" returns
  nothing relevant [P].
- Hosted "Medusa Search" (keyword/semantic/hybrid as a managed service) is Cloud
  only, vector/hybrid on Scale or Enterprise plans [P,
  docs.medusajs.com/cloud/search/comparison]. Irrelevant here: we bring Typesense.
- **Gaps**: no price or price-list events in the events reference [P], so a
  price change (our markup edit, an Intercars cost move) must trigger a reindex
  from our own code; but in our design prices come from our own SupplierOffer
  sync, so we emit that ourselves anyway. The provider interface already broke
  once: v2.20.0 removed `@medusajs/search-local` and made `searchMany` mandatory
  for providers [P, v2.20.0 release notes].

### Vendure

- Core ships `DefaultSearchPlugin` with a pluggable `SearchStrategy`
  (`getSearchResults`, `getTotalCount`, `getFacetValueIds`, `getCollectionIds`),
  built-ins for Postgres/MySQL/SQLite [P,
  docs.vendure.io/reference/typescript-api/default-search-plugin/search-strategy].
  A Typesense strategy would still run inside the plugin's DB indexer
  [INFERENCE from the interface shape]. The search guide says Algolia,
  Typesense or Meilisearch can be swapped in by a plugin implementing the same
  GraphQL resolvers [P, docs core-concepts/search].
- **Typesense is a paid feature.** vendure.io/pricing lists "Typesense search
  engine" under **Growth, EUR 599/month** (and above); "Self-hosting doesn't
  change the plan price" [P, vendure.io/pricing, read 2026-10-17]. The
  `@vendure/create` docker-compose template ships a Typesense container pointing
  at the "advanced search plugin" on the Vendure hub [P,
  `packages/create/templates/docker-compose.hbs`].
- Elasticsearch moved out of core to `@vendure-community/elasticsearch-plugin`
  (PR #4591, 2026-03-30) [P]. No free community Typesense plugin on npm or GitHub [P, searched].
- Events: `ProductEvent`, `ProductVariantEvent`, `ProductVariantChannelEvent`,
  `StockMovementEvent`, and a `ProductVariantPriceEvent` class exists in source
  [P]; indexing runs on the worker via the job queue [P].

**Verdict: Medusa, clearly.** On Medusa we write one provider class (8
methods) into a framework that owns indexing, batching, reindex and
event-driven sync, and nothing is paywalled. On Vendure we either pay EUR
7,188/year for the vendor's Typesense plugin or write a whole search plugin
(indexer, job-queue wiring, GraphQL resolvers) ourselves. Either way the
Typesense _document shape_ (how a Part with N identifiers and N offers becomes
documents) is our design, on both.

## 4. Fitment/VIN custom domain

Both need an entirely custom Vehicle + Part-Vehicle fitment model (#334) with a
first-class "needs confirmation" fitment-candidate state (GLOSSARY).

- **Medusa**: a `fitment` module (`model.define` Vehicle, Fitment with a
  `needs_confirmation` state), `defineLink` to Product; custom store routes under
  `src/api/store/...`; reads via `query.graph` across links [P mechanism].
  Modules are isolated by design: no foreign keys or SQL joins across module
  boundaries, links live in link tables [P, module-links docs]. Cross-module
  filtering has had performance issues (`maybeApplyLinkFilter` 10x slower,
  #13356, closed) [P]. Precedent: **Wipertech** (wiper blades, AU/NZ) built
  vehicle fitment as a custom data layer in Medusa: 3,000+ vehicle applications,
  6,000+ vehicle-specific variants, "thousands" of fitment relationships [S,
  medusajs.com/blog/wipertech].
- **Vendure**: TypeORM entities in a plugin, in the same schema as Product, so a
  "parts for vehicle X" query is a plain join or a `QueryBuilder` in a custom
  resolver, exposed via `shopApiExtensions` [P mechanism]. No automotive or
  fitment precedent found [P, searched].

**Verdict: Vendure, slightly**, for raw SQL ergonomics. The gap narrows in the
likely design: the storefront's "what fits my car" listing will be a Typesense
filter (vehicle ids on each search document), so the join runs at index time
in a job, not per request. Medusa has the only real fitment precedent of the
two, though it is vendor marketing.

## 5. Admin usable by the owner + 1-2 staff

Two flows matter: (a) editing a supplier's markup %, (b) manual fitment
curation (#332, still open).

- **Medusa**: admin extensions are widgets (`src/admin/widgets/*.tsx`,
  `defineWidgetConfig`, zones like `product.details`), UI routes (whole custom
  pages), the Admin SDK and `@medusajs/ui` [P,
  docs.medusajs.com/learn/fundamentals/admin/widgets]. Price Lists are editable
  by non-devs in the stock admin [P, user-guide/price-lists]. No cost or markup
  field. (a) needs a small UI route (supplier list + markup input); (b) needs a
  custom UI route. The team already wrote two production-shaped widgets
  (`product-spec.tsx`, `publish.tsx`) [P]. RBAC is Enterprise-only (see 8),
  irrelevant for one role.
- **Vendure**: the React `@vendure/dashboard` is the default since v3.5.0; the
  Angular admin is end-of-life ("will not be maintained after July 2026") [P,
  dashboard migration guide]. Extensions via `defineDashboardExtension` with
  `ListPage`, `DetailPage`, custom form components [P]. **Custom fields render
  form inputs and list columns automatically** [P, developer-guide/custom-fields],
  so a `markupPercent` custom field on `Seller` or `StockLocation` is editable
  with zero admin code. Custom entity CRUD (SupplierOffer, fitment) is hand-built
  pages; no auto-generated CRUD [P].
- Neither stock admin can do fitment curation. Both need a custom page.

**Verdict: Vendure, slightly**, for (a) only, and only if Supplier is modelled
as a custom field on a core entity rather than its own entity. (b) is a custom
page on both. Note the Vendure dashboard is about a year old as the default;
Medusa's has been the only admin through all of v2.

## 6. Payment: CorvusPay / Monri WSPay

- **Medusa**: Payment Module Provider, `AbstractPaymentProvider<Options>` with
  `initiatePayment`, `authorizePayment`, `capturePayment`, `refundPayment`,
  `cancelPayment`, `deletePayment`, `getPaymentStatus`, `updatePayment`,
  `retrievePayment` and `getWebhookActionAndData` (the PSP callback handler)
  [P, docs.medusajs.com/resources/references/payment/provider]. Whether a
  ready-made webhook route dispatches to that method out of the box is
  [NOT VERIFIED] in this pass.
- **Vendure**: `PaymentMethodHandler` (`createPayment` returning `Settled` or
  `Authorized`, plus settle/refund/cancel), registered in
  `paymentOptions.paymentMethodHandlers`; payment methods configured in the
  dashboard [P, docs.vendure.io/reference/typescript-api/payment/payment-method-handler].
  A PSP callback needs a custom controller in the plugin [INFERENCE from how the
  Stripe/Mollie plugins are structured; not read line by line].
- **No plugin for CorvusPay, Monri or WSPay exists for either** (npm 404 for the
  obvious names, GitHub search empty) [P, searched]. A generic `corvuspay` npm
  client (1.0.6, 2025) exists, not tied to either platform [P].

**Verdict: parity.** One adapter class per PSP on either, behind a clean
interface. Cash-at-pickup is a manual/system payment provider on both.

## 7. Localized product content (ru/en/sr)

**This corrects the baseline survey**, which said no surveyed platform solves
product-field localization. Both do, first-party.

- **Medusa**: Translation module `@medusajs/medusa/translation`, v2.12.3+,
  translates Product, ProductVariant, ProductCategory, ProductCollection and
  more, and custom data models too; the Store API picks the locale from the
  `locale` query param, then the `x-medusa-locale` header, then falls back to
  the original; a cart carries `locale` into the order [P,
  docs.medusajs.com/resources/commerce-modules/translation, .../storefront,
  .../custom-data-models]. **Still behind a feature flag in 2.21**:
  `packages/medusa/src/feature-flags/translation.ts` has `default_val: false`
  [P]. The old guide's rule "the translation module needs two switches ...
  either alone looks enabled and is not" is first-hand team experience [P], and
  the old code already ran ru-authored, AI-translated sr/en product content
  through it (`subscribers/translate-product.ts`, `jobs/translate-backlog.ts`,
  `metadata.translated_from_<locale>` hashes) [P].
- **Vendure**: core-native `Translatable`/`Translation<T>`, `LocaleString`
  fields, `ProductTranslation`/`ProductVariantTranslation`, `languageCode` per
  request, and `localeString`/`localeText` custom fields stored per language
  [P, developer-guide/translatable]. Not feature-flagged; has been core since v1.
  Whether `sr` is in the `LanguageCode` enum was not checked [NOT VERIFIED];
  it is an ISO 639-1 code, so very likely.

In both, the per-row translation itself (ru authored, en/sr generated) is
ours: `@podbor/i18n`'s translate core can be reused as the translator, but the
trigger is a platform subscriber/job, not the YAML section loader.

**Verdict: Vendure**, for maturity (no flag, localized custom fields for free).
Medusa's works and the team has shipped against it, but "experimental flag
in a minor-release-breaks-things codebase" is a real risk to watch.

## 8. Licensing

- **Medusa: MIT, with one carve-out the baseline missed.** `LICENSE`: "Except for
  the Enterprise Edition materials identified in ENTERPRISE-LICENSE.md, the
  repository is licensed under the MIT License." `ENTERPRISE-LICENSE.md`: "RBAC
  (role-based access control) and SSO (single sign-on) are Medusa Enterprise
  Edition features", listing `packages/modules/rbac/`, the RBAC flows, admin
  routes and dashboard pages, and `auth-oidc`; "Enabling any Enterprise feature
  flag constitutes a representation that you hold a valid commercial agreement"
  [P, both files via `gh api`]. GitHub reports the license as NOASSERTION for
  this reason. The map needs no RBAC/SSO (one role, owner + 1-2 staff), so
  nothing this shop needs is gated. Cloud-only: managed search (keyword/
  semantic/hybrid) and the Cloud hosting extras; Cloud pricing Develop $29,
  Launch $99, Scale $299/mo, Enterprise custom (RBAC, SSO, audit logs) [S,
  medusajs.com/pricing].
- **Vendure: GPLv3 Core is fine for a private backend, by Vendure's own words.**
  vendure.io/licensing FAQ: "Under GPLv3, interaction with users over a network,
  with no transfer of a copy, is not conveying. Your shoppers receive no copy."
  On plugins: "The plugin exception in Vendure's licence covers plugins
  distributed separately from Vendure Core that contain no Core source. They can
  use any licence." [P, vendure.io/licensing]. The repo's `license/license-faq.md`
  says the same and adds that Vendure cannot give legal advice [P]. GPLv3, not
  AGPL, so running CarLab's own backend without distributing it triggers no
  obligation. v2.3 was the last MIT version [P]. **But the paid plans carry
  features**: Starter EUR 199, Growth EUR 599 (incl. Typesense), Scale EUR 2,499
  per month, Enterprise EUR 60k+/yr [P, vendure.io/pricing]. Multi-vendor,
  multi-channel and the dashboard are free in Core [P, vendure.io/core].

**Verdict: Medusa.** Both are clean for this use. The difference is commercial,
not legal: Vendure's business model sells capabilities on top of Core, and the
one capability on this map's list it sells is exactly Typesense. Medusa's paid
carve-out (RBAC/SSO) is off this map's list.

## 9. Operational cost

|                               | Medusa                                                                                                                                                                                    | Vendure                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processes                     | server (`MEDUSA_WORKER_MODE=server`) + worker [P, docs learn/deployment/general]                                                                                                          | server (`bootstrap`) + worker (`bootstrapWorker`) [P]                                                                                                     |
| Required services             | Postgres; Redis recommended for cache, event bus, workflow engine, locking in production [P]                                                                                              | Postgres (or MySQL/MariaDB); BullMQ on Redis "recommended for production" for the job queue, DB-backed queue possible [P]                                 |
| Memory                        | at least 2 GB [P]; old stack capped Medusa at 1.5 GB [P]                                                                                                                                  | 512 MB minimum, 200-300 MB idle per process [P, server-resource-requirements]                                                                             |
| Serverless                    | not addressed in docs [NOT VERIFIED]                                                                                                                                                      | no serverless guide; long-running server [P]                                                                                                              |
| Team assets                   | full compose stack, Dockerfile, deploy/backup/restore/SSH scripts, CI image boot, integration-test harness, a rules guide [P, `origin/main` history]                                      | none                                                                                                                                                      |
| Release churn (since 2025-06) | 46 releases, 15 mention "breaking" [P, crude text match on release notes]; minors every 3-4 weeks; 2.20 capped Store API relation depth, 2.21 strips non-allowlisted Store API fields [P] | 30 releases, 10 mention "breaking" [P, same crude match]; minors every ~2-3 months; 3.x moved Elasticsearch/Stripe/Mollie etc. out of core (PR #4591) [P] |

**Both are long-running Node servers with a worker, Postgres and Redis; neither
fits the repo's Vercel-function instinct.** The deploy shape is nearly
identical, so the old `infra/medusa` compose stack would be about 80% reusable
for Vendure too (swap the image) [INFERENCE]. "Proven pattern vs new pattern"
is therefore weaker than the brief frames it: the real asset is Medusa-specific
knowledge (the rules in `docs/guides/medusa.md`), not the VPS pattern.

Known Medusa pain points, from the team's own guide [P]:

- Translation module needs two switches; either alone looks enabled.
- Middleware that rewrites a body must mutate both `req.validatedBody` and `req.body`.
- `metadata` must be written read-merge-write under a lock.
- Order `fulfillment_status`/`payment_status` are not queryable on the graph.
- Express path matchers are exact, so `/admin/products/:id` also catches `/batch`.
- Redis event-bus subscribers share one queue at concurrency 1.
- `typecheck` needs the generated `.medusa/types` from a build first.
- `@medusajs/test-utils` forces jest in a vitest monorepo.

Vendure costs: less RAM (cheaper VPS), slower minor cadence; unknown-unknowns
for this team, GraphQL-only APIs (the Astro storefront talks REST/fetch today),
TypeORM migrations.

**Verdict: Medusa, slightly.** Real but CI-only knowledge plus a ready
stack, against a higher RAM bill and faster breaking churn.

## 10. Future-proofing past the BMW pilot

- **Catalog scale**: neither documents a variant ceiling. Medusa has
  **Partbase**, "500,000+ products" on Medusa Cloud with search through a
  third-party engine wired by subscribers [S, medusajs.com/blog/partbase], and
  the Wipertech fitment build [S]. Vendure's case studies (HANS KOHLER, Munch,
  Hemglass, IBM, Weishaupl, SKYdeals) state no SKU count and none is auto parts
  [P, vendure.io/case-studies].
- **Known performance issues**: Medusa closed large-catalog issues #12287,
  #13356, #13890, #13976, #14727, #13783; open #17253 (workflow values
  deep-copied several times), #17297, #17257 (admin variant/image loading) [P].
  Vendure open #4387 and #5537 (N+1 on collection variants and
  `Product.facetValues`), #2733, #3459; #5035 added batch loading (closed
  2026-07) [P]. Both have fixable rough edges at scale; neither shows a hard
  ceiling. With Typesense serving listing/search, most catalog reads leave the
  platform anyway.
- **Pricing complexity**: per-category/per-brand markup (a fast-follow) is our
  own pricing function on both. Medusa Price Rules can carry context rules if we
  ever push computed prices into Price Sets; Vendure's strategy is arbitrary code.
- **More suppliers**: a new row in our Supplier entity on both.
- **Online payment, delivery**: provider interfaces on both (Medusa
  fulfillment providers, Vendure `ShippingCalculator`/`FulfillmentHandler`).
- **Ecosystem**: Medusa 36,774 stars / 5,428 forks; Vendure 8,522 / 1,522
  (repo moved to `vendurehq/vendure`) [P, `gh api`, 2026-10-17]. Vendure GmbH
  (Vienna) is a 2022 joint venture; no completed funding round found
  [NOT VERIFIED]. Medusa's commercial health was not researched beyond its
  Cloud pricing.
- **Future paid-tier exposure**: Medusa gates RBAC/SSO (relevant only if the team
  grows into roles). Vendure gates gift cards, packaging units, contract pricing,
  audit log, Typesense, among others [P].

**Verdict: Medusa, slightly**, on precedent and ecosystem size, both [S]-weight
evidence. No ceiling found on either.

---

## Recommendation

**Build the shop on Medusa (v2, current 2.21.x).**

Why, in order of weight:

1. **Typesense** is mandated, and only Medusa gives it a free, first-party seat:
   a provider interface its own core names Typesense for, inside a module that
   already owns indexing, batching and reindexing. On Vendure the same thing is
   either EUR 599/month or a search plugin written from zero.
2. **"Maximize ready-made"** (map #320's standing tie-breaker): beyond search,
   Medusa's free surface covers everything on this map, and the only gated
   features (RBAC/SSO) are things the map explicitly does not need. Vendure's
   free Core is also complete for commerce, but its paid tiers sit right on
   our path.
3. **The team already knows Medusa 2.x's sharp edges**: translation flags,
   workflow hooks, admin widgets, the query layer, the compose stack and CI
   image. That knowledge is CI-tested, not production-tested (see the
   correction above), but it is real and none of it exists for Vendure.
4. **The rest is parity or close to it**: same custom Supplier/SupplierOffer/
   fitment work on both, same PSP adapter work, same long-running deploy.

What Vendure genuinely does better, and what we give up: a cleaner per-line
price hook (`OrderItemPriceCalculationStrategy` with line custom fields),
mature non-flagged localization, auto-rendered admin inputs for custom fields,
SQL-join ergonomics for fitment, and lower RAM. None of these is worth a
from-scratch search plugin or a EUR 7k/year subscription against this map's
priorities.

### What would make this the wrong call (watch list)

- **Typesense provider pain**: if writing the provider against
  `AbstractSearchProviderService` turns out to fight the index shape we need
  (a Part with N identifiers and N offers, vehicle-id filters), or the interface
  breaks again the way 2.20 broke it. Prototype the provider first; it is the
  load-bearing reason for this pick.
- **Translation module stays experimental or regresses**: it is still
  `default_val: false` in 2.21. If it breaks on an upgrade, product-content
  localization falls back to our own columns, which removes one of Medusa's
  parity points.
- **Frozen custom prices**: custom-priced line items are not repriced on cart
  refresh (core source). If a checkout re-check against live supplier offers
  proves fragile, Vendure's per-line strategy was the better seat.
- **Breaking churn**: roughly a third of releases since mid-2025 mention
  breaking changes. If upgrades routinely cost more than a day, pin a minor and
  upgrade on a schedule, or re-weigh.
- **Fitment query performance across module links**: if "parts for this
  vehicle" cannot be served from Typesense and cross-module link filtering
  stays slow at our catalog size, Vendure's same-schema joins would have been
  simpler.
- **Admin effort**: if the markup and fitment admin pages balloon, Vendure's
  auto-rendered custom fields would have saved real work on the markup half.
- **The team grows into roles**: RBAC on Medusa is an Enterprise contract.

### Before committing code (cheap de-risking, in order)

1. Spike a Typesense search provider on a scratch Medusa 2.21 app, indexing a
   Part with two brand-variants and three offers, filtered by a vehicle id.
2. Spike the custom add-to-cart workflow with an `offer_id` and the
   `completeCartWorkflow.hooks.validate` live-price re-check.
3. Confirm the Translation module on 2.21 covers the custom `supplier`/`fitment`
   models we need localized (if any) and Product/Variant fields.

If spike 1 fails, the recommendation flips to Vendure with the paid Growth
plan priced in, or to Vendure plus a custom search plugin.
