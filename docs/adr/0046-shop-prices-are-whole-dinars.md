---
status: accepted
---

# Shop prices are whole Serbian dinars

Confirmed with the owner 2026-10-25, before the shop's first production deploy.

**Decision:** every amount the shop stores is an `integer` of whole RSD: an Offer's `cost_price`, a Category's `service_price` and `installation_price`, a Part's `installation_price`. The sell price is the cost times the Supplier's `markup_percentage`, rounded to a whole dinar (`sellPrice` in `apps/auto-service-shop/src/modules/supplier/pricing.ts`). An Offer keeps its `currency` column, and one not in RSD is neither sold nor shown (`inShopCurrency`), as [ADR-0045](0045-offer-cart-closed-beta-order-lead.md) already says.

**Why:** the shop sells in Serbia only, para are not used in retail prices, and an integer leaves no rounding drift between the Publish snapshot, the live quote and the order. Changing the unit after launch means a migration that rewrites every price column and every place that reads one, so the unit is fixed now, while the tables are empty.

## Consequences

- A Supplier that quotes in another currency, or in fractions of a dinar, is converted to whole RSD by its adapter at import. The shop never stores a foreign amount it would have to convert at sale time.
- Selling in a second currency would be a new decision, and a schema change with it.
