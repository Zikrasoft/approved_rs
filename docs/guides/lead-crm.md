# Lead capture, the CRM bot and the capture bots

Unqualified paths are relative to `apps/approved-rs/`. Webhook registration and
the bots' environment variables are in [deploy.md](deploy.md).

## One store, three brands

**One CRM bot, one chat, one lead store, three brands — plus a capture bot
each.** Telegram allows a single webhook URL per bot, so the CRM bot's
`api/telegram-webhook.ts` and `api/reminders.ts` are deployed only by
`apps/approved-rs`; the other two apps ship `/api/leads`, `/api/contact-click`
and their own capture bot's `/api/telegram-capture`, and carlab.rs also
`/api/shop-orders`, where the shop hands over its placed and canceled orders. All three write to the same `crm` Postgres database
and are separated by the lead's `brand` field, which the
app's `createBrandBot({ brand })` stamps on — a visitor can never set it.
Give all three sites the same `CRM_DATABASE_URL`.

**A lead captured for a sister brand is stored as that brand's.** approved.rs's
partner block can open its own form for CarLab or Details, and
`src/lib/notifyLead.ts` maps the partner service slug onto that brand's name
(`PARTNER_SERVICE` in `packages/brands`) before the store sees the lead. So
`brand` still means "whose lead this is", and `source_url` is what says the
visitor came from approved.rs. The visitor still cannot name a brand: they can only pick one
of the two partner slugs the page renders, and every other value falls through
to approved.rs itself.

**Each site writes its own leads.** A brand site posts to its own
server-side route rather than another brand's origin: three separate site
servers on three separate domains, so a cross-origin POST buys nothing but a
CORS config to maintain.

## The pipeline

**Lead capture pipeline (`@podbor/lead-crm`, bound in `src/lib/crm.ts` + `src/lib/crmBot.ts`):** form submissions (`api/leads.ts`), call-button clicks (`api/contact-click.ts`) and, on carlab.rs, placed shop orders (`api/shop-orders.ts`) and Failed checkouts (`api/order.ts`, CONTEXT.md) all funnel through `notifyLead`, which stores the lead and notifies Telegram through `inBackground` from `@podbor/lead-crm/background` (fire-and-forget after the response redirects, a rejection logged, `SIGTERM` held until it settles). Leads live in the `crm` Postgres database (ADR-0063), one relational table per thing: `leads`, `digests` with their `digest_leads` (the record that lets the daily digest claim its day once and remember which Leads it listed), `lead_notes` for staff notes, `ledger_operations` and `operation_prompts` for Payouts and Settlements, and `quarantined_records` for what the one-time Blob import could not read. The schema is `packages/lead-crm/prisma/schema/`, Prisma 7 over the `pg` driver adapter, and nothing outside `createLeadStore` / `createLedgerStore` touches a table. Money is not on a Lead: the Balance is the sum of `ledger_operations` (ADR-0032). Every invariant the old Blob compare-and-swap loop gave is now the database's: a single-Lead change locks its row (`SELECT … FOR UPDATE` in a transaction), `insertOrMergeLead` takes a per-brand advisory lock and locks every candidate it could merge into, `(brand, order_id)` and the pending prompt's `(chat_id, message_id)` are unique, a digest day is unique, and ledger writes take one advisory lock so a Settlement never overdraws and a prompt is answered once. `packages/lead-crm/src/races.test.ts` runs each one as a race against real Postgres. Lead ids are uuid v7 and stay internal (callback data, digest links); people see the Lead's `number`, a sequence shown as `#123` on cards, the digest, lists and notices, and the bot's search finds `#123` or `123`. A Lead imported from Blob keeps its old numeric id as that number, and new Leads continue 1000 above the highest imported one, a gap kept for the Leads that reach Blob during the cutover. `api/telegram-webhook.ts` handles the bot side (status changes, ➕ Зачислить / ➖ Списать prompts, postpone/remind flow). `✅` marks a Lead won and asks nothing; a reply to a Lead card in the group is ordinary discussion and stores nothing; notes go in only through the DM detail's 📝 Заметка, and the DM detail edits a Lead's name or gives a Lead without a real contact one (`pendingPrompt` `edit_*`, telling the other role what changed; a contact typed for a Lead that already has a real one (`hasRealContact`) is appended as a note, never written over it) or appends a 📝 note signed with author and date, which the other role is told about too. The owner and the admin both change statuses on the card and the DM detail, and `afterStatusChange`'s `author` sends the other role the notice (`sendStatusChange`, never to the author). The digest has no buttons and only links each Lead. `dropFromDigest` redraws it without a Lead from the ids its `digest` record keeps, also forgetting Leads closed or deleted since; it runs from `afterStatusChange` when an `author` is set, and directly from the webhook for 🔵 on a Lead already in progress and for a deletion. The cron's own resume of due postponed Leads has no author and leaves the digest alone. A status move into work (🗣, 🔵) never reopens a won or lost Lead: `setStatus` refuses it, and leaving `postponed` clears the reminder. The visitor's comment is read-only: staff text goes in only as a note, a row of `lead_notes` (author, text, time) that the card and the DM detail print under the comment as `16.10.2026 · Админ: …`. A postponement is such a note too. **Every Lead the site creates carries the Ad visit** (CONTEXT.md): `bootSiteKit` remembers a paid landing in `localStorage` for 30 days under the visitor id's consent, the form and the click beacon post it as `AD_SOURCE_FIELD` (JSON), `adSourceFieldSchema` validates it in both routes, and it lands as `adSource` on the Lead, `null` when absent or unreadable. `insertOrMergeLead` keeps the first one, so a Capture bot Lead absorbing a Telegram click inherits it; the card, the DM detail and the Topic summary show «📣 Реклама» and `#реклама`. **A Topic exists only for a Lead that came through a Capture bot in Telegram**: WhatsApp, Viber, phone and form Leads have none, so a Lead feature must work on the card and the DM detail and never assume a Topic. `api/reminders.ts` is a cron endpoint a host timer calls with `Authorization: Bearer $CRON_SECRET` that expires Ghost leads and posts one daily digest to the group: due `postponed` leads and open leads with no action for 7 days. There is no monthly summary.

The binding is split in two on purpose: `src/lib/crm.ts` builds the store and needs no Telegram credentials, while `src/lib/crmBot.ts` builds the bot and reads `TELEGRAM_*` at module load. Importing the store therefore cannot fail a build over a missing bot token. `src/lib/store.ts`, `src/lib/telegram/index.ts` and `src/lib/notifyLead.ts` are thin re-exports over those two.

## The schema

**An enum holds the domain's own values.** Every vocabulary the CRM owns (status, kind, prompt kind, capture step, referrer, contact channel, note author, operation type, digest list) is a Postgres enum whose values are the lowercase strings the code uses, so a row maps to a `StoredLead` with no case conversion, and `src/schema.test.ts` holds each Prisma enum equal to its TypeScript list (`TRACKED_CONTACT_CHANNELS`, `LEAD_STATUSES`, …). `brand`, `locale` and `service` stay `text` on purpose: their values are configuration owned elsewhere (`packages/brands`, each app's locale set, the service labels), stamped by the server or checked by the app's `isLocale` and `serviceSlugSchema` before the store sees them, so a new brand or locale needs no CRM migration; `brand` also holds the display name (`Approved.rs`), which a Prisma 7 enum value cannot be without a name-to-identifier mapping in the code. A Lead's id is the branded `LeadId` (`leadIdSchema`), parsed where an id arrives as text (callback data, a `/start` payload), so a Lead `number` cannot pass for one. The Blob import and every schema only it reads live in `packages/lead-crm/src/legacy/` with `scripts/import-blob.ts`, deleted together after the Vercel fallback week.

**Tests.** `src/testing/databaseServer.ts` (vitest's `globalSetup`, run in the main process) and `src/testing/database.ts` (the `setupFiles` entry) are left out of the package's coverage because v8 cannot measure them there; every test runs through both. A site's `/api/leads` and `/api/contact-click` tests call `testLeadsRoute` and `testContactClickRoute` from `@podbor/lead-crm/testing`, which post through the app's real route and wait for its background work with `backgroundIdle`.

## grammY

**grammY for every bot, no sessions**. Why: `docs/adr/0031-grammy-for-every-bot.md`. Callback dispatch is the `[pattern, requiredRole, handler]` table `CALLBACKS` in `apps/approved-rs/src/pages/api/telegram-webhook.ts`, each row registered as a grammY `callbackQuery` handler; a new callback is a row there. A prompt lives on the record it answers (`pendingPrompt` on a Lead, or a row in `operation_prompts` for ➕/➖), matched by chat id and message id, never in a grammY session and never by the replied-to text.
