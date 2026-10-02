---
status: accepted
---

# A contact click that never gains a contact retires itself

Decided 2026-10-02 on issue #91, split out of #56.

Someone taps a messenger tile and never writes. A Lead is stored, a card lands in the operator's Telegram with the contact shown as a dash, and there is nothing to answer. The operator waits to see whether a message arrives, then deletes the card by hand. Every one of those is a false to-do, and making approved.rs's messenger tiles direct multiplies them.

The only party who knows whether the person wrote is the operator, sitting in Telegram: the manager account is a human account and the conversation never touches our infrastructure. So the choice is between never creating the card and retiring it on a timer. The card stays, because a tap is worth seeing while it might still turn into a conversation. The chore goes.

**A Ghost lead is a contact click whose contact is still the placeholder, whose status is still `new`, which is not archived, and which is older than the retention window.** All four conditions, deliberately narrow: a click the operator advanced is their work, and a click the store's visitor-merge window upgraded with a real contact is a conversion. `isGhostLead` in `packages/lead-crm/src/store.ts` is the only definition.

**The retention window is `GHOST_LEAD_RETENTION_MS` = 24 hours, swept once a day by the existing reminder cron, so a Ghost lead actually lives 24 to 48 hours.** That range is the guarantee, not the constant. An hourly schedule would need a plan change and buys the operator nothing.

**The sweep is a store method, not route logic.** `expireGhostLeads(now)` takes the clock, goes through the same compare-and-swap `updateLeads` path as every other mutation, and returns the Leads it changed. `api/reminders.ts` gains one call, a loop that refreshes each card through `ensureLeadCard`, and an `expiredGhosts` counter — the shape it already uses for postponed reminders. The first run is uncapped: the whole backlog goes in one pass, and the per-Lead `try`/`catch` is what keeps a Telegram rate-limit response on one card from stranding the rest.

Expiring sets **both** `archived` and `lost`. Archive is what removes the Lead from every active list and total; lost is the honest reading of «не написал». One sweep covers all three brands — they share one Lead store, and the bot, its webhook and the cron are hosted by approved.rs alone — and the sweep does not filter on `brand`.

## Considered Options

- **Never create the card.** Cheapest, and it was rejected: the operator loses the live signal that someone tried to reach us at all, which is the one thing a tap does tell us.
- **Delete the Telegram message instead of editing it.** Rejected: scrolling back and seeing that someone tried that day has value, and an edit needs no new Telegram client method — `refreshLeadCard` already drives the edit.
- **Delete the Ghost lead row from the store.** Rejected: archive already removes it from every list and total, and an archive is reversible from the bot (`♻️ Восстановить`) while a delete is not.
- **A second cron on an hourly schedule.** Rejected: new infrastructure to shorten a window nobody is watching.

## Consequences

- **Any lost rate drawn from this data counts ghosts**, so it is not a measure of how well we close real Leads. Accepted knowingly; the alternative is a sixth status whose only reader is a report nobody has asked for yet.
- Analytics is unaffected: the contact-click goal fires in the browser at tap time, so tap volume stays visible whatever the CRM later does with the Lead.
- Deduplicating contact clicks per visitor and channel — one card instead of three for a visitor who taps three tiles — is still open, and much less urgent now.
