# Leads live in one JSON file on Vercel Blob, not in a database

Every lead is a record in `data/leads.json` on Vercel Blob. All writes go through `updateLeads()`, an ETag compare-and-swap loop with jittered exponential backoff, and records are zod-validated on read. Storage sits behind a `LeadStorage` interface, so moving to Postgres later is one adapter, not a rewrite. At this volume (tens of leads a month) a database is more to run than the data justifies.

## Considered Options

The store changed four times, and each rejected option is one someone may propose again:

- **Neon Postgres, raw SQL** (original MVP design, June 2026): dropped before real use (commit `d23a4f1`) — a hosted DB to operate for a handful of rows.
- **No storage, Telegram message only**: no history, no search, no status once the message scrolled away.
- **Google Sheets via an Apps Script Web App** (shipped August 2026, removed in `4f08ef9`): a second place to look, the script lived outside the repo and was redeployed by hand, it needed its own row-lock against concurrent appends, and it could not hold bot state (pending prompts, reminders, deal amounts).

## Consequences

- A record that stops parsing (e.g. after a schema change) is copied to `data/leads-unreadable.json` and the admin is told in Telegram; nothing is removed from `data/leads.json` automatically. With an empty `TELEGRAM_ADMIN_ID` the quarantine happens silently.
- The file is shared by three deployments, which is why a partial `packages/*` deploy is forbidden ([ADR-0008](0008-deploy-only-what-is-stale-in-production.md)).
- Open: `get` followed by `head` in `packages/lead-crm/src/storage/vercelBlob.ts` can pair content with the ETag of a newer version; the CAS then succeeds against content the reader never saw. Needs checking against production ETag behaviour.
