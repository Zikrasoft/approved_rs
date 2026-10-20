---
status: accepted
---

# A Telegram tap offers the bot or the manager

Decided 2026-10-20. Amends the Telegram half of [ADR-0015](0015-lead-form-asks-only-for-a-contact.md).

A Telegram tile opens the brand's capture bot, and a visitor who reaches it through the browser lands on t.me, then on an empty bot chat with a Start button. Some visitors do not want to talk to a bot and leave there: the CRO audit behind ADR-0015 already saw visitors go hunting for a direct messenger link, and a bot is one more thing that is not a person.

**A tap on a Telegram tile that opens the capture bot asks first: through the bot, or the manager directly.** The tile is still a plain link to the bot, so with JavaScript off, or before it loads, a tap opens the bot as before. With JavaScript, one `<dialog>` per page offers both: the bot link carrying the tapped tile's `?start=` payload, and the brand's `PUBLIC_TG_MANAGER` account. The bot is listed first because it is the path that stores a Lead with a Telegram identity. Tiles that already open the manager (the `/thanks/` carve-out, approved.rs's footer «Написать менеджеру») do not ask.

**The bot's own profile names the manager too.** A `{manager}` in the `profile` copy of `captureBot.yaml` becomes `@` plus `PUBLIC_TG_MANAGER` when `capture-bot-profile.ts` runs, so the description in the empty chat before Start and the short description on the bot's page both say whom to write to.

## Considered Options

- **Bot profile only.** No change to the sites, but a visitor has to reach the bot chat before seeing the alternative.
- **A plain second Telegram tile for the manager.** Doubles every Telegram control in every placement and asks the visitor to choose before they know why.

## Consequences

- One more tap on every Telegram path with JavaScript. ADR-0015 priced a detour that broke its label's promise; this one keeps the promise, since both options open Telegram, but its cost is measured: `contact_click` fires on the tap, `telegram_choice` (`option`: `bot` or `manager`) on the pick, and the difference is the visitors who closed the dialog.
- A manager pick stores no Lead with a Telegram identity: the tile's tap still beacons its placeholder click Lead, which retires itself like any other contact click that never gains a contact. The conversation lives in the manager's own chat, outside the CRM.
- CarLab and Details now bind `humanTelegram` like approved.rs, so their `/thanks/` Telegram tile opens the manager as well.
