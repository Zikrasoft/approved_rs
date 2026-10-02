# One Telegram bot and one lead store for all brands, separated by a `brand` field

All three sites write leads to the same `data/leads.json` on one Vercel Blob store, and one Telegram bot posts them to one operator chat. The lead's `brand` is stamped by the server (`createNotifyLead({ brand })`), never taken from the visitor. Telegram allows exactly one webhook URL per bot, so the bot has to see every brand's leads from a single deployment anyway.

**Amended by [ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md): the single bot is now the CRM bot, and each brand has its own visitor-facing capture bot.** The store is still one and `brand` still separates it, but the brand is no longer stamped only by a site's route — which capture bot received the update identifies it, and that is what keeps the brand a server fact once a `?start=` payload the visitor controls is in play. The rejected option below stays rejected: it was three _CRM_ bots, with three chats and no single money summary.

## Considered Options

- **A storage key per business** (the original split plan): rejected — the single webhook would need a registry of stores and a store prefix in every `callback_data`. Splitting later is a migration of one JSON file.
- **A bot per brand**: rejected — the owner would get three chats and lose the single money summary. Worth revisiting only if a brand is ever sold separately.

## Consequences

- A `packages/*` change must reach all three apps together — see [ADR-0008](0008-deploy-only-what-is-stale-in-production.md).
- A lead keeps the `brand` and commission rate it was created with (`COMMISSION_PERCENT` in `packages/brands`, copied onto the lead). Renaming a brand or changing a rate never rewrites history, so past deal commissions stay what was agreed; the bot can still override the rate per lead. A lead captured by approved.rs's partner block for CarLab or Details is stored as that brand's, with that brand's rate.
