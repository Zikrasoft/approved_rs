# Lead capture, the CRM bot and the capture bots

Unqualified paths are relative to `apps/approved-rs/`. Webhook registration and
the bots' environment variables are in [deploy.md](deploy.md).

## One store, three brands

**One CRM bot, one chat, one lead store, three brands — plus a capture bot
each.** Telegram allows a single webhook URL per bot, so the CRM bot's
`api/telegram-webhook.ts` and `api/reminders.ts` are deployed only by
`apps/approved-rs`; the other two apps ship `/api/leads`, `/api/contact-click`
and their own capture bot's `/api/telegram-capture`, and carlab.rs also
`/api/shop-orders`, where the shop hands over its placed and canceled orders. All three write to the same `data/leads.json` on the
same Vercel Blob store and are separated by the lead's `brand` field, which the
app's `createBrandBot({ brand })` stamps on — a visitor can never set it.
Connect the same Blob store to all three Vercel projects.

**A lead captured for a sister brand is stored as that brand's.** approved.rs's
partner block can open its own form for CarLab or Details, and
`src/lib/notifyLead.ts` maps the partner service slug onto that brand's name
(`PARTNER_SERVICE` in `packages/brands`) before the store sees the lead. So
`brand` still means "whose lead this is", and `source_url` is what says the
visitor came from approved.rs. The visitor still cannot name a brand: they can only pick one
of the two partner slugs the page renders, and every other value falls through
to approved.rs itself.

**Each site writes its own leads.** A brand site posts to its own
server-side route rather than another brand's origin — three separate Vercel
projects on three separate domains, so a cross-origin POST buys nothing but a
CORS config to maintain.

## The pipeline

**Lead capture pipeline (`@podbor/lead-crm`, bound in `src/lib/crm.ts` + `src/lib/crmBot.ts`):** form submissions (`api/leads.ts`), call-button clicks (`api/contact-click.ts`) and, on carlab.rs, placed shop orders (`api/shop-orders.ts`) and Failed checkouts (`api/order.ts`, CONTEXT.md) all funnel through `notifyLead`, which stores the lead and notifies Telegram via `waitUntil()` (fire-and-forget after the response redirects). Leads live in a single JSON blob on Vercel Blob (`data/leads.json`), not a database: one array of Leads beside `digest` marks (the record that lets the daily digest claim its day once). Money is not in that file. Payouts and Settlements live in their own blob, `data/ledger.json`, behind `createLedgerStore` — the Balance has nothing to do with any Lead. While that blob does not exist the Balance reads as zero; nothing in the Lead file is ever carried into it (the one-time carry-over is gone, ADR-0032). Every mutation goes through `updateRecords()` (`updateLeads()` is its Leads-only shorthand), a compare-and-swap loop with jittered exponential backoff so two concurrent writers (e.g. a bot button edit racing a new form submission) desync instead of retry-colliding. Storage sits behind a `LeadStorage` interface, so moving to Postgres later is one adapter rather than a rewrite. `api/telegram-webhook.ts` handles the bot side (status changes, ➕ Зачислить / ➖ Списать prompts, postpone/remind flow). `✅` marks a Lead won and asks nothing; a reply to a Lead card in the group is ordinary discussion and stores nothing — notes go in only through the DM detail's 📝 Заметка, and the DM detail edits a Lead's name or gives a Lead without a real contact one (`pendingPrompt` `edit_*`, telling the other role what changed; a contact typed for a Lead that already has a real one — `hasRealContact` — is appended as a note, never written over it) or appends a 📝 note signed with author and date, which the other role is told about too. The owner and the admin both change statuses on the card and the DM detail, and `afterStatusChange`'s `author` sends the other role the notice (`sendStatusChange`, never to the author). The digest has no buttons and only links each Lead. `dropFromDigest` redraws it without a Lead from the ids its `digest` record keeps, also forgetting Leads closed or deleted since; it runs from `afterStatusChange` when an `author` is set, and directly from the webhook for 🔵 on a Lead already in progress and for a deletion. The cron's own resume of due postponed Leads has no author and leaves the digest alone. A status move into work (🗣, 🔵) never reopens a won or lost Lead — `setStatus` refuses it, and leaving `postponed` clears the reminder. The visitor's comment is read-only — staff text goes in only as a note. **Every Lead the site creates carries the Ad visit** (CONTEXT.md): `bootSiteKit` remembers a paid landing in `localStorage` for 30 days under the visitor id's consent, the form and the click beacon post it as `AD_SOURCE_FIELD` (JSON), `adSourceFieldSchema` validates it in both routes, and it lands as `adSource` on the Lead, `null` when absent or unreadable. `insertOrMergeLead` keeps the first one, so a Capture bot Lead absorbing a Telegram click inherits it; the card, the DM detail and the Topic summary show «📣 Реклама» and `#реклама`. **A Topic exists only for a Lead that came through a Capture bot in Telegram** — WhatsApp, Viber, phone and form Leads have none, so a Lead feature must work on the card and the DM detail and never assume a Topic. `api/reminders.ts` is a Vercel Cron job (needs `CRON_SECRET`) that expires Ghost leads and posts one daily digest to the group: due `postponed` leads and open leads with no action for 7 days. There is no monthly summary.

The binding is split in two on purpose: `src/lib/crm.ts` builds the store and needs no Telegram credentials, while `src/lib/crmBot.ts` builds the bot and reads `TELEGRAM_*` at module load. Importing the store therefore cannot fail a build over a missing bot token. `src/lib/store.ts`, `src/lib/telegram/index.ts` and `src/lib/notifyLead.ts` are thin re-exports over those two.

## grammY

**grammY for every bot, no sessions** — why: `docs/adr/0031-grammy-for-every-bot.md`. Callback dispatch is the `[pattern, requiredRole, handler]` table `CALLBACKS` in `apps/approved-rs/src/pages/api/telegram-webhook.ts`, each row registered as a grammY `callbackQuery` handler; a new callback is a row there. A prompt lives on the record it answers — `pendingPrompt` on a Lead, or an operation prompt in `data/ledger.json` for ➕/➖ — matched by chat id and message id, never in a grammY session and never by the replied-to text.
