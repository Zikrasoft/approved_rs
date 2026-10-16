---
status: accepted
---

# The new Order lives in its own store; a companion Lead carries the Telegram notification

Decided 2026-10-16, as part of the new parts-shop architecture
(`docs/adr/0035-build-the-new-parts-catalog-custom.md`).

The old Medusa-era map recorded "Orders keep living in the same lead blob as
the three brands' enquiries" — but that referred only to a companion Lead
record Medusa created alongside each real Order so the Telegram conversation
had a home (CONTEXT.md: "An Order also produces a Lead so the conversation
has a home, but that Lead's status is not the Order's state."). The Order
itself was always Medusa's, never the Lead blob's
(`docs/adr/0027-medusa-owns-the-order-the-bot-only-notifies.md`): the owner
advanced it in the Medusa admin, its fulfillment and inventory reservation
lived there, and `packages/lead-crm`'s Vercel-Blob compare-and-swap store
was never its source of truth.

The new shop keeps that same shape with Medusa's role replaced by the new
Postgres database: **the Order's source of truth is the new system's own
store**, not `packages/lead-crm`'s JSON blob. Rejected: storing the Order
itself in the Lead blob, which was considered and ruled out because that
store's CAS-retry-with-backoff design is sized for rare leads and clicks, not
a relational catalog with Part/SupplierOffer joins, stock reservations and
a real Order lifecycle.

**What does move, on purpose**: placing an Order still creates a companion
Lead in `packages/lead-crm`, exactly as Medusa's Orders did, purely so the
existing Telegram notification/conversation machinery (`crmBot.ts`, the
owner's DM detail, the daily digest) keeps working without having to learn
a second, relational data model. That Lead's status is never read as the
Order's state, the same rule as before.
