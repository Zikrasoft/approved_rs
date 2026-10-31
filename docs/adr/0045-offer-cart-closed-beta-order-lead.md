---
status: accepted
---

# Selling from the catalogue: a live-quoted offer cart, lead-time orders, add-ons, a closed beta, and every order as its own Lead

Confirmed with the owner 2026-10-23, against the code PR #357 ships. Extends [ADR-0043](0043-supplier-adapters-catalogue-import-page-per-brand-number.md) and replaces, for the new shop, what [ADR-0018](0018-serbia-only-pickup-pay-on-collection.md), [ADR-0022](0022-orders-reach-the-bot-through-a-signed-hook.md), [ADR-0025](0025-shop-status-and-dev-preview.md) and [ADR-0027](0027-medusa-owns-the-order-the-bot-only-notifies.md) said for the old one.

**Decision:**

- **The cart holds Offers, and checkout re-quotes them live.** Prices on pages are the Publish snapshot. Adding to the cart and checkout quote price and stock again through the Supplier's adapter (a Manual offer quotes its stored row). Only Offers in the shop currency are sold or stored.
- **Checkout asks only for a contact,** payment is cash at pickup, and the cart carries a fingerprint of what the customer saw. Checkout refuses a changed price, lost stock or lead time, a line without an Offer, a missing contact and a cart that changed since it was shown (`CHECKOUT_REFUSALS` in `@podbor/catalog-contract`). The page shows «было X, стало Y» per changed line and keeps the typed contact.
- **An Offer with a lead time is orderable beyond its stock.** `orderCap` is the stock when the lead time is 0, and `max(stock, LEAD_TIME_ORDER_CAP)` (10) when it is not, so a line can be ordered from the supplier with zero stock on hand. The Lead says per line «в наличии» or «забрать через N дней», and the Offer JSON-LD marks such a line `BackOrder`. An Offer with neither stock nor a lead time is not buyable.
- **Add-ons are sold per unit, next to the Part:**
  - an **Add-on service** (`service_label`, `service_price`, `service_note` on the Category), e.g. registering a battery in the car's control unit;
  - **installation at CarLab**: a price on the Category, overridden per Part (`installation_price`) or switched off for it (`no_installation`), shown on the part page, cart, receipt and `llms.txt`.

  Each one is an order line of its own, priced quantity × unit price.

- **Closed beta.** With `SHOP_OPEN` unset, the production default on both the carlab.rs build and the shop backend, the catalogue is public and indexable but buying is off:
  - the build bakes no price, no Offer JSON-LD and no add-on price, every part says «Узнать цену», and there is no cart link;
  - the backend's store routes answer with no offers or price filter, and creating, filling or completing an offer cart is 403 without the `x-shop-preview: 1` header.

  `?dev=1` sets a cookie that loads prices client-side and sends that header, so testers buy for real. `SHOP_OPEN=true` opens everything and puts prices in the HTML, which is when ADR-0043's "builds bake the current prices into the structured data" applies. This is a soft gate, not access control: anyone who knows the flag can order. (Amended: the flag is now the secret `SHOP_PREVIEW_TOKEN`, set once through `/api/shop-preview` and sent to the backend as the header's value; see deploy.md, Closed beta.)

- **A placed order becomes a Lead.** The `order.placed` subscriber posts to carlab.rs's own `/api/shop-orders` (amended: first `/api/leads`; the body is `@podbor/lead-crm/shop-orders-wire`, and only a 2xx means the Lead is stored), which stores it as service `parts-order` with the order id, the attribution the cart carried, the VIN, the car and the lines. A job retries a failed handoff every 10 minutes, up to 6 times, and order markers keep a retried order from becoming two Leads. With no live price, or the backend down, the customer gets a Parts inquiry (`vin-parts-inquiry`) instead.
- **A `parts-order` Lead never merges into another real Lead** (`standaloneServices` in `@podbor/lead-crm`): every order is its own card, even from a visitor who already sent a form.
- **Staff see orders in the shop admin:** a widget on the order page shows the contact, VIN, car, comment, lines with their availability, cash at pickup and the Lead handoff state, and the order list flags orders whose Lead handoff has not succeeded (`/admin/carlab-orders`).

## Consequences

- `@podbor/lead-crm` gains `orderId`, `ORDER_ID_FIELD` and `standaloneServices`, so this change redeploys all three sites together (intended, see AGENTS.md on the deploy filter). The same change also hardens the package for the order path: a lock around the file storage's compare-and-rename, a 4xx instead of a 500 for a body that is not a form, comment line breaks normalised to LF, and a CommonJS build of `./contact-channel`, `./limits`, `./fields`, `./parts-order-copy` and `./phone` for `@podbor/catalog-contract`.
- Ordering past the stock relies on the supplier honouring its lead time; there is no reservation upstream.
- No Telegram alert yet when an order Lead fails all retries: the order stays in the shop admin.
- The shop funnel goals (`add_to_cart`, `begin_checkout`, `purchase`) are still not fired by this cart.
