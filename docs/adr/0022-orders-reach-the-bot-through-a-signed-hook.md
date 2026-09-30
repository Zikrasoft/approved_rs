---
status: accepted
---

# Medusa owns orders; the bot hears of them through a signed webhook to carlab.rs

In `main` since PR #34.

Medusa is the source of truth for orders. On `order.placed` a subscriber POSTs an HMAC-SHA256-signed payload (`t=…,v1=hmac(t.body)`, 300 s window, secret ≥ 32 chars, exact signed bytes sent) to `apps/auto-service/src/pages/api/shop-order.ts`, which verifies the raw body, parses it with `orderHookSchema`, and posts a card to the same Telegram chat through `notifyLead`. The lead CRM and bot stay in one place.

## Consequences

- The Redis event bus retries a failed subscriber up to 5 times (~2.5 min), so the receiver dedupes by `orderId` with a private Blob marker `shop-orders/<orderId>.json` (`allowOverwrite: false`). It _awaits_ the card rather than using `waitUntil`, so a failure returns 5xx and Medusa retries; `notifyLead` was changed to return whether delivery succeeded. An outage longer than ~2.5 min loses the card, not the order.
- Email and webhook are separate subscribers so one's retry never repeats the other; email dedupes against earlier notifications.
- An order card uses `visitorId: null`, otherwise `insertOrMergeLead` would fold it into the visitor's open lead. The lead schema is unchanged in phase 1; bot↔Medusa status sync is later.
- **The marker protects the card, not the lead row.** `notifyLead` stores the lead before it reports that Telegram failed, and the marker is written only after success, so each of the 5 attempts leaves another row in `data/leads.json` — and `visitorId: null` disables the merge that would absorb them. The audit on issue #63 named it (findings 1 and 3); the fix is to write the marker before `notifyLead`, taking `allowOverwrite: false` as a lock, and it is on the checklist on #61 before `SHOP_STATUS` leaves `off`.
- `cart.locale` is set only from the `POST /store/carts` body (not `x-medusa-locale`), so the storefront sends it on create and on language switch; it decides the email language.
- Preview-period orders are real orders marked `metadata.preview: true` and cancelled by hand.
