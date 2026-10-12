---
status: accepted
---

## Amended 2026-10-12: a Capture bot Lead never retires

The owner reverted both 2026-10-11 amendments below. A Capture bot Lead whose contact is `tg://user?id=…` is a real, reachable Lead — the owner can answer it through the reply-through-the-bot button — so the sweep never retires it, bare `/start` or not. `isGhostLead` is back to the placeholder Contact click alone, and `serviceChosenInBot` is gone with `isBareStart`. What stays from 2026-10-11: the retention window is measured from the last visitor activity (`visitorActiveAt ?? createdAt`), and a contact only ever moves up on merge — placeholder < `tg://user?id=…` < phone or username. The Questionnaire now asks a visitor with no username for a phone as its last step ([ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)), so fewer such Leads reach the owner on the bare id at all. `negotiations` is a status again ([ADR-0005](0005-telegram-bot-is-the-crm.md)); the sweep needs `open`, so a Lead in negotiations never retires.

## Amended 2026-10-11 (later): only a bare `/start` retires

The owner narrowed the amendment below. A Capture bot Lead without a phone or a username retires only when it is a bare `/start`: no comment — which is where every Questionnaire answer and every message the visitor sends the bot lands — and no service the visitor chose in the bot (`serviceChosenInBot`, set by «Leave a request» on a service card and by the Questionnaire's service buttons). Any visitor answer keeps the Lead open for the owner, who can reach such a visitor through the reply-through-the-bot button. A service that only came with the site tile's `/start` payload, or a Partners referral, is not an answer. A phone or a username still never auto-closes. `isBareStart` in `packages/lead-crm/src/store.ts` is the definition. A no-username `/start` merged into the visitor's Telegram-tile click now also takes the click's place with the `tg://user?id=…` contact, so a contact ranks placeholder < bare id < phone or username on merge, and a merge only ever moves it up.

## Amended 2026-10-11: a contactless `/start` is a Ghost lead too

A Capture bot Lead whose contact is still `tg://user?id=…` — the visitor has no Telegram username and never shared a phone — gives the owner nobody to write to, the same dead end as a placeholder click. The owner decided it retires the same way: same `GHOST_LEAD_RETENTION_MS`, same `expireGhostLeads` sweep in the reminder cron, same `lost`. The predicate is still the one `isGhostLead`: open, no owner activity (`lastActivityAt` unset), never gained a contact, and the retention window measured from the last visitor activity (`visitorActiveAt ?? createdAt`) — a visitor still answering the Questionnaire keeps the Lead alive. "Never gained a contact" is the `contact` field alone: the Capture bot writes `@username` when there is one and replaces the bare id with the phone when one is shared, so a Lead with a phone or a username has a contact that is neither, and never auto-closes. Such bare `/start` Leads therefore no longer sit in the 7-day digest. For that to hold, a site form merged into a bare `/start` inside the visitor-merge window now takes the bare id's place with its own contact, the way it already replaced a placeholder click's; a username or a phone already on the Lead is never overwritten.

## Amended 2026-10-10: no archive, a Ghost lead is only marked lost

Issue #226 removes the archive from the CRM bot: lost is the archive now, and only open Leads are listed. Expiring a Ghost lead sets `lost` alone, and "not archived" drops out of the predicate. `new` is gone with the other two pre-outcome statuses, so "still `new`" now reads "still `open` with no recorded activity" (`lastActivityAt` unset): ⏳ on the card, a card reply or a postpone takes a click out of the sweep the way moving it off `new` used to, and the migration stamps `lastActivityAt` on a Lead stored as negotiations or in_progress. See [ADR-0032](0032-the-owner-states-the-payout.md) for the same rework.

## Amended 2026-10-06: Telegram taps can be Ghost leads again

The paragraph below that takes Telegram out of this no longer holds. [ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md), amended the same day, has a Telegram tap store a contact click again so the bot's Lead can inherit its page. A tap whose visitor reaches Start is merged into the bot's Lead and gains a contact; one who never does leaves a placeholder click that this sweep retires like any other. Nothing in the predicate or the sweep changed.

# A contact click that never gains a contact retires itself

Decided 2026-10-02 on issue #91, split out of #56.

Someone taps a messenger tile and never writes. A Lead is stored, a card lands in the operator's Telegram with the contact shown as a dash, and there is nothing to answer. The operator waits to see whether a message arrives, then deletes the card by hand. Every one of those is a false to-do, and making approved.rs's messenger tiles direct multiplies them.

The only party who knows whether the person wrote is the operator, sitting in Telegram: the manager account is a human account and the conversation never touches our infrastructure.

**[ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md) takes Telegram out of this.** A capture bot's `/start` is observable and yields a contact, so a Telegram tap no longer stores a contact click at all and can no longer become a Ghost lead. What is written here holds for the phone, WhatsApp and Viber — every remaining ghost comes from those three. So the choice is between never creating the card and retiring it on a timer. The card stays, because a tap is worth seeing while it might still turn into a conversation. The chore goes.

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
