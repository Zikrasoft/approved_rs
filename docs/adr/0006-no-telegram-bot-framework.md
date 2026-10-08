# No Telegram bot framework

The bot (about fifteen callback handlers and a five-kind `pendingPrompt` state machine over `force_reply`) is hand-rolled on the Bot API, not built on grammy or telegraf. The webhook is a serverless function, so telegraf's long-running `bot.launch()` model collapses to `handleUpdate` plus a cold-start cost; a framework's scenes want a session store keyed by user, while `pendingPrompt` deliberately lives on the lead record in Blob because a prompt belongs to a lead and two operators can act on one lead; and the client already encodes domain knowledge no framework supplies (`safeEditMessage` swallowing "message is not modified", `notify.ts` swallowing "message to edit not found").

## Consequences

What has outgrown hand-rolling is the dispatch in `handleCallbackQuery` (a chain of callback-data regexes and early-return role guards). When it hurts, the fix is a `[pattern, requiredRole, handler]` table in the same file, not a framework.

**Update 2026-10-08:** the table landed — `CALLBACKS` and `dispatchCallback` in `apps/approved-rs/src/pages/api/telegram-webhook.ts` replace the regex chain, and prompt replies dispatch from a table the same way. A new callback is a row there.
