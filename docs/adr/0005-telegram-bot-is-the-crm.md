# The Telegram bot is the CRM, and lead capture never fails for the visitor

**Amended 2026-10-20: the digest has no buttons.** Each `#N` already opens the Lead in the bot, so the ✅ ❌ 🔵 row per Lead only repeated the card. The day's `digest` record keeps the message id and the Leads it lists; when staff decide on one of them from its card or detail, tap «🔵 В работе» or delete it, the digest is redrawn without it, as the buttons used to do. A redraw shows no per-row status.

**Amended 2026-10-12 a third time: statuses are no longer owner-only.** The owner and the admin both change a Lead's status — ✅ ❌ 🗣 🔵 ⏰ on the group card and the DM detail — and the other one gets a DM naming who changed it. A won or lost Lead still cannot be reopened; deleting stays the admin's. A role-gated button tapped by the wrong role answers with a toast saying whose it is. The «owner-only» wording below is superseded.

**Amended by [ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md): the CRM bot is `@SerbCRMBot`.** `@ApprovedRsBot` held this role until then and is now approved.rs's visitor-facing capture bot, with every operator surface removed. Capture bots write Leads and never manage them.

**Amended 2026-10-11 by [ADR-0032](0032-the-owner-states-the-payout.md) (#226, #241): the DM no longer edits a Lead's fields, keeps a separate archive, or asks for a deal amount or commission** — lost is the archive, and money is one Balance changed by ➕/➖ operations, off the Leads. The cron no longer DMs reminders: it posts one digest to the group, and a due postponed Lead reopens through it.

**Amended 2026-10-12 again: the six statuses are back as they were before #226.** new (🆕 Новая), negotiations (🗣 Переговоры), in_progress (🔵 В работе), won (✅ Успешно), lost (❌ Отказ), postponed (⏸️ Отложена). A Lead stored as `open` reads back as `new`; `negotiations` and `in_progress` read back as themselves. new, negotiations and in_progress are in work: the open list, search, the stats, the 7-day digest and postponing count all three, and the Ghost sweep needs `new`. The group card carries ✅ ❌ / 🗣 🔵 ⏰ (owner-only); 🔵 replaces the ⏳ touch, and on a Lead already in progress it records the touch. ⏰ opens the remind picker on the card as in the DM. A postponed Lead remembers the status it left (`postponedFrom`); on its day the cron returns it there (new when none is recorded), DMs the owner «Ты просил напомнить сегодня — заявка снова активна.» and lists it in the group digest, once per day under the digest claim. The paragraph below is superseded where it disagrees.

**Amended 2026-10-12: negotiations is back.** Statuses are open, negotiations (🗣 Переговоры), won, lost and postponed. A reply to the visitor through the bot moves an open Lead into negotiations, and 🗣 on the group card or the DM detail does it by hand, owner-only like ✅/❌. A Lead stored as `negotiations` reads back as one instead of being migrated to open; `new` and `in_progress` still migrate to open. Negotiations is not closed: the open list, the 7-day digest, search and the stats count it, and the Ghost sweep never touches it.

Operators manage leads in a private chat with the bot: the group gets only a short teaser and an "Open in bot" button; status, edits, archive, deal amount, commission and postpone/remind all happen in the DM, driven by the same Blob store. A Vercel Cron (`/api/reminders`, 08:00 UTC, `CRON_SECRET`) pushes due postponed leads back to the owner.

Capture is fail-open: the route redirects to `/thanks/` immediately and does storage + Telegram in `waitUntil()`; if the store insert fails, Telegram is still notified "without CRM tracking"; a honeypot hit is redirected to `/thanks/` as if it succeeded. Losing a notification is judged better than showing an error on a conversion page.

## Considered Options

- **Status buttons in the group** (original design): the group became unreadable and status lived in message text.
- **Google Sheet as the ledger, Telegram as fire-and-forget** (August 2026): see [ADR-0004](0004-leads-in-one-vercel-blob-json-file.md).
