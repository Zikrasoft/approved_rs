# The CRM bot decides whether a shop Order is completed

A shop Order had no completed state: staff closed its `parts-order` Lead in the CRM bot (✅ won, ❌ lost) and the Order in the shop never changed. We make the bot the place that decides it. Marking the Lead won completes the Order in the shop (picked up and paid); there is no way back from the shop, because staff work the deal in the bot and a second "completed" button in the shop admin would let the two disagree. Cancelling is linked both ways: ❌ lost in the bot cancels the Order, and cancelling the Order in the shop admin marks the Lead lost, because an Order can be cancelled from the shop for reasons the bot never sees (a supplier that cannot deliver).

## Consequences

A Parts sourcing case study can only be drafted from a completed Order, so "completed" has one source. The bot calls the shop to complete or cancel an Order, and the shop already posts to the Lead route, so each side needs credentials for the other; a bot change that fails to reach the shop must be retried rather than leave the two out of step.

In the shop, `createOrderLeadSync` in `lib/order-lead-sync.ts` runs every entry point (the placed and canceled subscribers, the retry job and the CRM's outcome call) under one lock, `order-lead:<order id>`, so a retry and a live event never hand the same Order over twice. A cancel that comes from the CRM stamps `lead_lost_at` before it cancels the Order, so the `order.canceled` subscriber finds the Lead already lost and does not echo the cancel back; if cancelling fails, the stamp is cleared again. When the CRM answers a cancel with 404, 409 or 410 (its Lead is won or deleted), the shop records the refusal and stops retrying.
