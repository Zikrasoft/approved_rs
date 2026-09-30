---
status: accepted
---

# Medusa owns the Order; the Telegram bot only notifies

Decided 2026-09-30 while grilling the shop spec (issue #77), before branch `feat/carlab-shop` was merged.

A shop order exists in two stores at once and nothing reconciles them. Medusa holds the Order with its own status and fulfillment; the lead store holds a Lead whose vocabulary is a sales pipeline — `new`, `negotiations`, `in_progress`, `won`, `lost`, `postponed`. The operator presses «Завершить» on the bot card and the Medusa order stays `pending` forever, keeping its inventory reservation. No code writes back to Medusa from either the bot or the storefront.

**Medusa is the single source of truth for an Order.** The operator advances an order — picked, handed over, cancelled — in the Medusa admin. The bot card is a notification and the thread where the conversation with the buyer happens; its Lead statuses describe the _conversation_, never the order's fulfillment state.

## Considered Options

- **The bot writes to Medusa**: extra buttons on the order card calling the Admin API. One interface for the operator, but it puts an admin credential inside the `approved.rs` webhook function — the one deploy that already holds the bot token for all three brands — and every new order action becomes a new callback pattern in a regex chain that [ADR-0006](0006-no-telegram-bot-framework.md) deliberately keeps small. Rejected for now, not forever: if the operator turns out to live in Telegram and never opens the admin, this is the upgrade path.
- **Two independent objects, never reconciled**: cheapest, and what the code does today by accident. Rejected because it leaves the inventory reservation of an uncollected order held forever with nothing that even names the problem.

## Consequences

- The operator works in two interfaces: Telegram for the conversation, Medusa admin for the order. Accepted — the admin already exists and has the statuses the owner asked for, and no new code is written to avoid a second tab.
- `Lead.status` must not be read as an order state anywhere. A `won` lead says the conversation closed, not that the parts left the counter.
- Cancelling an order is what releases its inventory reservation. The operator does it in the admin; after the reserve window the hourly `release-uncollected` job does it unasked, and the order email tells the buyer that window up front.
- The spec in issue #77 has no order-lifecycle user stories. That gap is real and is filled by this decision rather than by the code.
