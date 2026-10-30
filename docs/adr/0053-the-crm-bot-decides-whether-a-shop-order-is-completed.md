# The CRM bot decides whether a shop Order is completed

A shop Order had no completed state: staff closed its `parts-order` Lead in the CRM bot (✅ won, ❌ lost) and the Order in the shop never changed. We make the bot the place that decides it. Marking the Lead won completes the Order in the shop (picked up and paid); there is no way back from the shop, because staff work the deal in the bot and a second "completed" button in the shop admin would let the two disagree. Cancelling is linked both ways: ❌ lost in the bot cancels the Order, and cancelling the Order in the shop admin marks the Lead lost, because an Order can be cancelled from the shop for reasons the bot never sees (a supplier that cannot deliver).

## Consequences

A Parts sourcing case study can only be drafted from a completed Order, so "completed" has one source. The bot calls the shop to complete or cancel an Order, and the shop already posts to the Lead route, so each side needs credentials for the other; a bot change that fails to reach the shop must be retried rather than leave the two out of step.
