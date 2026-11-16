# Moving the CRM to `@SerbCRMBot`

A runbook for one sitting. It moves the owner-facing CRM from `@ApprovedRsBot`
to `@SerbCRMBot` and gives every open lead a working card again. Why there are
four bots at all: [ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md).

A bot cannot edit a message another bot sent, so the moment the token changes,
every existing card goes frozen the moment the token changes. Step 6 says what
that costs and why it needs no script. Do not skip step 1.

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

On the host, as the deploy user:

```bash
/srv/carlab/backup.sh
docker compose -f /srv/carlab/docker-compose.yml exec -T postgres psql -U carlab -d crm -Atc 'select count(*) from leads'
```

`backup.sh` dumps the `crm` database as `crm-<stamp>.dump` beside the shop's
`db-<stamp>.dump`, whose path it prints, and copies both off the host like the
nightly run; the second line prints the Lead count and nothing else. Note both: the
count is what you compare against if anything later looks wrong.

In the old bot, open «🔴 Мне должны» as the admin and write the total down —
step 8 compares the Balance against it.

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

The sites take the env the Vercel projects hold only on their next deploy. Run
CI with **Deploy every app** so `approved-rs`, `auto-service` and `detailing`
ship again. Until this lands, the running sites still hold the old token.

## 5. Register the new bot's webhook

```bash
cd apps/approved-rs
node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts crm
```

The argument is mandatory. `crm` registers
`https://approved.rs/api/telegram-webhook` with `TELEGRAM_WEBHOOK_SECRET`; the
script prints `getWebhookInfo` afterwards. Check that `url` is the approved.rs
one and `last_error_message` is absent.

## 6. The old cards, and why nothing redraws them

A bot cannot edit a message another bot sent, so every group teaser posted by
`@ApprovedRsBot` is now frozen, and its buttons answer to a bot whose webhook
serves `/api/telegram-capture` and ignores callbacks. Tapping one does nothing.

**That is not a dead end and there is nothing to run here.** Open a DM with
`@SerbCRMBot`, send `/start`, and the menu, the lead list and search all draw a
fresh card on demand with working buttons — every open lead is reachable that
way immediately. And the first action you take on a lead heals its teaser:
`ensureLeadCard` tries the edit, Telegram refuses it, the code falls through and
posts a new teaser as `@SerbCRMBot`, rewriting `telegramChatId` /
`telegramMessageId` through the store's normal locked row update.

What you are left with until then is cosmetic: the frozen teasers stay in the
group, and a lead you act on gains a second, live one beside its dead twin.
Delete the dead ones by hand if they bother you.

The direct-message cards from before the switch stay dead for good. Only the
group teaser has a stored address; a DM card is rendered on demand when the
owner taps «Открыть в боте». Repointing `TELEGRAM_BOT_USERNAME` in step 3 is
what makes that link open `@SerbCRMBot` — ADR-0030 accepts the rest.

## 7. Check the CRM answers at all

```
DM @SerbCRMBot → /start → menu → the lead list
```

A lead opens, its card has buttons, and a status change sticks. That is the
whole proof the migration landed; it writes nothing you have to undo.

## 8. Smoke checks

In the leads group and in a DM with `@SerbCRMBot`:

- [ ] A teaser from step 7 is in the group, and its «Открыть в боте» button opens
      `@SerbCRMBot`, not `@ApprovedRsBot`.
- [ ] **Status change** — open a lead from the teaser, close it as «✅ Сделка» or
      «❌ Отказ»; the DM card redraws and the group teaser's status line follows.
      The admin can do the same; whichever of the two did not tap gets a DM
      naming who changed it.
      «🗣 Переговоры» and «🔵 В работе» move it without closing it; «🔵» on a
      Lead already in progress records a touch, so the Lead drops out of the
      stale list.
- [ ] **Payout** — in the DM menu tap «➕ Зачислить», reply `1 тест`; the bot
      answers `✅ +1 € · баланс …` and the admin gets the notice. Undo it with
      «➖ Списать» `1`.
- [ ] **Postpone** — «⏰ Отложить» on the group card or the DM detail, pick a
      date; the lead goes to `postponed` and `remindAt` is set. On that day
      `/api/reminders` (daily) lists it in the group digest, returns it to the
      status it was postponed from and DMs the owner a reminder; to check it
      now, set the date to today and wait for the next run.
- [ ] **A new form lead** — submit the lead form on approved.rs; a new teaser
      appears, posted by `@SerbCRMBot`.
- [ ] **A shop order** — place a test order on carlab.rs (or re-fire the order
      hook); the order notification arrives from `@SerbCRMBot`. This is what
      proves the `auto-service` project picked up the new token too.
- [ ] A lead submitted on details.rs produces a card — same proof for the third
      project.
- [ ] **The Balance opened**: «💶 Мне должны» in `@SerbCRMBot` equals the
      total noted in step 1.
- [ ] **The first digest** — the next morning's group digest lists every open
      Lead untouched for 7 days or more, the backlog included. A tap on one of
      its «✅ Сделка #N» / «❌ Отказ #N» / «🔵 В работе #N» buttons — the owner's
      or the admin's — drops that row from the message. Every
      capture-bot `/start` Lead is among them, a bare one included, and stays
      in every digest until someone closes it (#226, #241): only a placeholder
      Contact click retires itself as a Ghost lead.

## 9. Done

Discard the old token once every box above is ticked.

## 10. Rollback

Two values, the two from step 3:

1. Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` back to `@ApprovedRsBot`'s
   in all three Vercel projects, which hold the sites' env, and redeploy them
   (CI with **Deploy every app**).
2. Re-register the webhook against the old token:

   ```bash
   curl "https://api.telegram.org/bot<OLD_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://approved.rs/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

Nothing else changed. Leads written during the switch keep working — but any
teaser posted as `@SerbCRMBot` becomes the frozen one, and heals the same way in
reverse the first time you act on that lead.

If the lead store itself looks wrong, the step 1 dump is the restore source
(see [deploy.md](deploy.md#crm-migrations)):

```bash
docker compose -f /srv/carlab/docker-compose.yml exec -T postgres pg_restore -U carlab -d crm --clean --if-exists --no-owner --role=crm --single-transaction <crm-<stamp>.dump
```

It replaces the whole `crm` database with the dump, so anything written since
is lost: compare the Lead count against the one you noted before you run it.
