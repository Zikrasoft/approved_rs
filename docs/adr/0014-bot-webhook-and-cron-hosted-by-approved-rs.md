---
status: accepted
---

# The bot webhook and reminders cron are hosted by the approved.rs project

`api/telegram-webhook.ts`, `api/reminders.ts` (with the `crons` entry in its `vercel.json`) and `TELEGRAM_WEBHOOK_SECRET` / `CRON_SECRET` exist only in `apps/approved-rs`. "One bot" is a real Telegram constraint (one webhook URL per bot) and a second cron over the shared `data/leads.json` would send every reminder twice. "The webhook lives in approved.rs" is not a constraint — it is history.

**Narrowed by [ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md) to the CRM bot and the cron.** Each brand's capture bot hosts its own webhook in its own project — a bot per brand is precisely what lifts the one-webhook-per-bot constraint that put everything here. The cron stays single for the reason above: a second sweep over `data/leads.json` would send every reminder twice.

## Considered Options

1. **A fourth, service-only Vercel project** on `*.vercel.app` holding the webhook, cron and admin routes — removes the coupling, no new domain, the owner's chat stays single.
2. **A bot per brand** — full independence but three chats and no single money summary; only if a brand is sold separately.
3. **Leave as is** — the current state.

## Consequences

Taking the approved.rs project down kills the bot buttons and reminders for CarLab and Details too, while their own sites and forms keep working; nothing in their deploys shows it. Whether to move it is tracked in `docs/guides/open-questions.md`.
