# The CRM lives in Postgres, relational, beside the shop

Supersedes [ADR-0004](0004-leads-in-one-vercel-blob-json-file.md).

The three sites leave Vercel for the shop's VPS, where a Postgres already runs.
Leads, digests, Payouts and Settlements move from the Blob JSON files into a
separate `crm` database there, with its own role that can reach nothing else.
The schema is relational and lives in `packages/lead-crm/prisma/schema/`
(Prisma 7, `pg` driver adapter); only `adSource` stays a JSON column, because
nothing queries inside it.

The Blob store's whole-file compare-and-swap is replaced by the database
enforcing each invariant where it belongs: row locks for a single Lead's
read-modify-write, a per-brand advisory lock plus candidate row locks for
`insertOrMergeLead`, unique `(brand, order_id)`, unique pending-prompt
`(chat_id, message_id)`, unique digest day, and one ledger advisory lock so a
Settlement cannot overdraw and an operation prompt is answered once. Each is
tested as a race against real Postgres.

Lead and operation ids become uuid v7, used inside the system and in callback
data. People see a Lead's `number` instead: a short sequence (`#123`) the bot,
the cards, the digest and search show. A Lead imported from Blob keeps its old
numeric id as its `number` (and as `legacy_id`, the import's key), and the
sequence continues above the highest imported one. Telegram buttons and digest
links sent before the move stop working, which the owner accepted.

## Considered Options

- **Keep the Blob files on the self-hosted sites**: a Vercel dependency for one
  file, and every write rewrites every Lead.
- **A JSON column per Lead in Postgres**: keeps the shape but none of the
  constraints, so the races the CAS loop handled would come back.
- **Keep numeric ids**: a sequence per table would do, but the owner wants the
  same uuid v7 ids as his other projects and accepted losing old buttons. A
  uuid is unreadable on a card, so a Lead carries its number beside it.
