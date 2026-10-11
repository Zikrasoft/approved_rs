# The Telegram bot is the CRM, and lead capture never fails for the visitor

**Amended by [ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md): the CRM bot is `@SerbCRMBot`.** `@ApprovedRsBot` held this role until then and is now approved.rs's visitor-facing capture bot, with every operator surface removed. Capture bots write Leads and never manage them.

**Amended 2026-10-11 by [ADR-0032](0032-the-owner-states-the-payout.md) (#226, #241): the DM no longer edits a Lead's fields, keeps a separate archive, or asks for a deal amount or commission** — lost is the archive, and money is one Balance changed by ➕/➖ operations, off the Leads. The cron no longer DMs reminders: it posts one digest to the group, and a due postponed Lead reopens through it.

Operators manage leads in a private chat with the bot: the group gets only a short teaser and an "Open in bot" button; status, edits, archive, deal amount, commission and postpone/remind all happen in the DM, driven by the same Blob store. A Vercel Cron (`/api/reminders`, 08:00 UTC, `CRON_SECRET`) pushes due postponed leads back to the owner.

Capture is fail-open: the route redirects to `/thanks/` immediately and does storage + Telegram in `waitUntil()`; if the store insert fails, Telegram is still notified "without CRM tracking"; a honeypot hit is redirected to `/thanks/` as if it succeeded. Losing a notification is judged better than showing an error on a conversion page.

## Considered Options

- **Status buttons in the group** (original design): the group became unreadable and status lived in message text.
- **Google Sheet as the ledger, Telegram as fire-and-forget** (August 2026): see [ADR-0004](0004-leads-in-one-vercel-blob-json-file.md).
