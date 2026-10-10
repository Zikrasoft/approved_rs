---
status: accepted
---

# grammY for every bot, state still on the Lead

Decided 2026-10-09. Supersedes [ADR-0006](0006-no-telegram-bot-framework.md) and the telegraf option rejected in [ADR-0030](0030-a-capture-bot-per-brand-takes-the-telegram-contact.md).

The Capture bots are becoming the whole brand inside Telegram: an inline menu of services and contacts, a Questionnaire per brand and `/lang`. That is a large enough Bot API surface across four bots that a typed client and one dispatch idiom pay for themselves, so both the CRM bot and the three Capture bots move to grammY, CRM first and with no change in behaviour. grammY over telegraf because it is typed against the current Bot API and its `webhookCallback` takes a standard `Request`, which is what a Vercel function hands us.

What ADR-0006 got right still holds: **no grammY sessions or conversations plugin.** A Questionnaire step and an operator prompt belong to a Lead, live on it in the Blob store, and are read back per update; menu navigation carries its state in `callback_data`. The CRM's in-memory `update_id` dedup and the client quirks (`message is not modified`, `message to edit not found`) move over as grammY middleware or error filters rather than disappearing.
