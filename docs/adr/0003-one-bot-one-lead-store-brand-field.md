# One Telegram bot and one lead store for all brands, separated by a `brand` field

All three sites write leads to the same `data/leads.json` on one Vercel Blob store, and one Telegram bot posts them to one operator chat. The lead's `brand` is stamped by the server (`createNotifyLead({ brand })`), never taken from the visitor. Telegram allows exactly one webhook URL per bot, so the bot has to see every brand's leads from a single deployment anyway.

## Considered Options

- **A storage key per business** (the original split plan): rejected — the single webhook would need a registry of stores and a store prefix in every `callback_data`. Splitting later is a migration of one JSON file.
- **A bot per brand**: rejected — the owner would get three chats and lose the single money summary. Worth revisiting only if a brand is ever sold separately.

## Consequences

- A `packages/*` change must reach all three apps together (the `...[tag]` turbo filter, see [ADR-0008](0008-deploy-only-what-is-stale-in-production.md)), otherwise one site writes records another cannot parse.
- The same Blob store must be _connected_ to all three Vercel projects; `BLOB_READ_WRITE_TOKEN` is never set by hand, or some leads land in a file the bot does not read.
- A lead captured by approved.rs's partner block for CarLab or Details is stored as that brand's lead, with that brand's commission rate; `source_url` records that it came from approved.rs.
