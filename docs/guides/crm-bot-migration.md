# Moving the CRM to `@SerbCRMBot`

A runbook for one sitting. It moves the operator-facing CRM from `@ApprovedRsBot`
to `@SerbCRMBot` and gives every open lead a working card again. Why there are
four bots at all: [ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md).

A bot cannot edit a message another bot sent, so the moment the token changes,
every existing card is dead markup. Step 6 redraws them. Do not skip step 1.

Have ready, from `@BotFather`:

- `@SerbCRMBot`'s token — this is the new `TELEGRAM_BOT_TOKEN`.
- `@SerbCRMBot` must already be in the leads group, with permission to post, edit
  and pin.
- The owner and the admin must each have sent `/start` to `@SerbCRMBot` once.
  Telegram forbids a bot from opening a DM, so without this the DM cards and the
  cron's reminders go nowhere.

Keep the old `@ApprovedRsBot` token in a scratch file until step 9 passes — it is
half of the rollback.

---

## 1. Back up the lead store

```bash
cd apps/approved-rs
vercel env pull .env.local            # only if BLOB_READ_WRITE_TOKEN is stale
node --env-file=.env.local --experimental-strip-types scripts/backup-leads.ts
```

It reads `data/leads.json` through the same Vercel Blob storage the app uses,
writes it to `apps/approved-rs/.local/leads-<timestamp>.json` (gitignored) and
prints the path and the record count. It never writes to the blob.

Note the record count. Step 6 should report an open-lead figure no larger than it.

## 2. Unregister the old bot's webhook

Still with the **old** `@ApprovedRsBot` token:

```bash
curl "https://api.telegram.org/bot<OLD_TELEGRAM_BOT_TOKEN>/deleteWebhook?drop_pending_updates=true"
```

From here until step 5 the CRM buttons do nothing. That is expected.

## 3. Change the Vercel values

Two variables, in **all three** projects (`approved-rs`, `auto-service`,
`detailing`) — all three send lead cards with the CRM bot:

| Variable                | New value                               |
| ----------------------- | --------------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | `@SerbCRMBot`'s token from `@BotFather` |
| `TELEGRAM_BOT_USERNAME` | `SerbCRMBot` (no `@`)                   |

Leave `TELEGRAM_GROUP_ID`, `TELEGRAM_OWNER_ID`, `TELEGRAM_ADMIN_ID` and
`TELEGRAM_WEBHOOK_SECRET` as they are. These two are the whole switch, and they
are the two the rollback in step 10 puts back.

Set the same two in `apps/approved-rs/.env.local` as well — steps 5 and 6 read
from there.

## 4. Redeploy all three projects

A Vercel environment variable only reaches the functions on the next build.
Redeploy `approved-rs`, `auto-service` and `detailing` from the dashboard, or
push an empty commit and let CI ship them. Until this lands, the deployed
functions still hold the old token.

## 5. Register the new bot's webhook

```bash
cd apps/approved-rs
node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts crm
```

The argument is mandatory. `crm` registers
`https://approved.rs/api/telegram-webhook` with `TELEGRAM_WEBHOOK_SECRET`; the
script prints `getWebhookInfo` afterwards. Check that `url` is the approved.rs
one and `last_error_message` is absent.

## 6. Redraw the open cards — dry run first

```bash
cd apps/approved-rs
node --env-file=.env.local --experimental-strip-types scripts/backfill-crm-cards.ts
```

Dry run is the default: it lists every lead it would touch — every Lead that is
not archived and whose status is neither `won` nor `lost` — and writes nothing,
to the blob or to Telegram. Read the list. If it names leads you expect to be
closed, close them in the bot first and re-run.

## 7. Redraw the open cards — apply

```bash
node --env-file=.env.local --experimental-strip-types scripts/backfill-crm-cards.ts --apply
```

For each lead it posts a fresh **group teaser** as `@SerbCRMBot`, pins it, and
rewrites `telegramChatId` / `telegramMessageId` through the store's normal
compare-and-swap write. It sends sequentially with a short delay, well under
Telegram's ~30 messages/second.

Running it twice is safe: on a second run the card is one `@SerbCRMBot` itself
sent, so the edit succeeds and no new message is posted.

**The direct-message cards are not redrawn, and cannot be.** Only the group
teaser has a stored address; a DM card is rendered on demand when the operator
taps the teaser's «Открыть в боте» deep link. Repointing `TELEGRAM_BOT_USERNAME`
in step 3 is what makes that link open `@SerbCRMBot`. Old DM cards sitting in the
operator's chat with `@ApprovedRsBot` stay dead forever — ADR-0030 accepts this.
Open the lead again from the group teaser instead.

Delete `scripts/backfill-crm-cards.ts` once this run is done. It is a one-off and
is deliberately untested; its safety is the dry run and its idempotence.

## 8. Smoke checks

In the leads group and in a DM with `@SerbCRMBot`:

- [ ] A teaser from step 7 is in the group, and its «Открыть в боте» button opens
      `@SerbCRMBot`, not `@ApprovedRsBot`.
- [ ] **Status change** — open a lead from the teaser, move it to «В работе»; the
      DM card redraws and the group teaser's status line follows.
- [ ] **Deal amount** — mark a lead «Успешно», answer the amount prompt by
      replying in the DM; the amount and the commission appear on the card and the
      admin gets the deal notification.
- [ ] **Postpone** — «Напомни мне», pick a date; the lead goes to `postponed` and
      `remindAt` is set. The cron (`/api/reminders`, daily) delivers it; to check
      it now, set the date to today and wait for the next run.
- [ ] **A new form lead** — submit the lead form on approved.rs; a new teaser
      appears, posted by `@SerbCRMBot`.
- [ ] **A shop order** — place a test order on carlab.rs (or re-fire the order
      hook); the order notification arrives from `@SerbCRMBot`. This is what
      proves the `auto-service` project picked up the new token too.
- [ ] A lead submitted on details.rs produces a card — same proof for the third
      project.

## 9. Done

Discard the old token once every box above is ticked.

## 10. Rollback

Two values, the two from step 3:

1. Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` back to `@ApprovedRsBot`'s
   in all three Vercel projects and redeploy.
2. Re-register the webhook against the old token:

   ```bash
   curl "https://api.telegram.org/bot<OLD_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://approved.rs/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

Nothing else changed. Leads written during the switch keep working — but the
cards the backfill posted as `@SerbCRMBot` become the dead ones, so re-run the
backfill with `--apply` under the restored token to redraw them.

If the lead store itself looks wrong, the step 1 backup is the restore source:

```bash
cd apps/approved-rs
node --env-file=.env.local --experimental-strip-types scripts/restore-leads.ts .local/leads-<timestamp>.json
node --env-file=.env.local --experimental-strip-types scripts/restore-leads.ts .local/leads-<timestamp>.json --apply
```

The first form is a dry run: it prints the backup's record count against the
live blob's and writes nothing. `--apply` overwrites `data/leads.json` with the
backup, so anything written since the backup is lost — read both counts before
you type it.
