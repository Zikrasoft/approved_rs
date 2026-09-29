---
status: proposed
---

# Phase 1 shop: one Serbian region, pickup only, pay on collection, installation as its own product

Implemented on branch `feat/carlab-shop`.

CarLab is a local workshop: one region "Srbija", RSD only, `country_code: 'rs'` enforced by the checkout guard, pickup at the workshop (0 RSD via `manual_manual`), payment at collection (`pp_system_default`), stock reserved on order. CarLab is not a PDV payer, so the tax region has no rates (it must still exist, or the cart 500s). Installation is a separate `services` product with inventory off, sold as its own cart line with its own price per product type. Guest checkout only; email required.

## Considered Options

Online payment (Serbian acquirers: NestPay/Payten, AllSecure, Monri), delivery, multi-region, accounts: out of phase 1 and additive later — a payment provider, a `shipping` fulfillment set. The checkout already lists options and providers from the API.

## Consequences

- The audience includes many Russian-speaking residents, so ru/sr/en are equal; the phone input keeps the country shortlist rather than forcing RS.
