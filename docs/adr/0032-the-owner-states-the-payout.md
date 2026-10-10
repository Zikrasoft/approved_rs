---
status: accepted
---

# The owner states the Payout; the system computes no commission

Decided 2026-10-09/10 on issue #226. Research: `docs/research/partner-deal-ledger-sheets-voice.md`, `docs/research/partner-deal-reporting-low-effort.md`.

The admin's cut is a percentage of the owner's net profit, and the rates vary: 10% for car selection, 50% when that client came from Europe, 10% for service and detailing, 50% on parts, repeat visits and upsells included. The CRM bot modelled this as one fixed rate per brand applied to each income the owner entered, so a 50% deal could not be recorded, and the owner found the flow too long to use at all. A ledger nobody fills in controls no money.

**The owner states the Payout — the amount they will send — and the system stores it as given.** No rate, no profit, no formula lives in the code. The rates stay in the agreement between the two people, and the admin checks a Payout against it by reading it, as they would have had to anyway: net profit was never verifiable from our side. A Lead can carry several Payouts, and a Payout can belong to no Lead (a returning client whose card is lost).

**What the admin receives is a Settlement: an amount, not a tick on a Lead.** The balance is all Payouts minus all Settlements, so a partial payment needs no special case. Only the admin records one. A Payout recorded before a Settlement is settled and only the admin can correct it after that; before, the owner can, and every Payout and every correction reaches the admin.

## Considered Options

- **Rate derived by rule** from brand plus "from Europe" and "parts" flags, the owner entering net profit. Rejected by the admin: more questions per deal, and the flags are as unverifiable as the amount.
- **A rate the owner picks from a dropdown.** Rejected: the weakest point for control, and still one more step than typing the amount.
- **A fixed fee per closed client.** Verifiable by calling the client, but rejected by the admin: the agreement is a percentage.
- **Google Sheets as the owner's surface**, as the owner first proposed. Rejected for now: the cards already land in Telegram, and a reply to one is fewer steps than finding a row ([ADR-0004](0004-leads-in-one-vercel-blob-json-file.md) for why Sheets is not the store).

## Consequences

- Stored Leads migrate: each income times its Lead's rate becomes a Payout on the same date, and each confirmed payment becomes a Settlement, so the balance owed does not move.
- `COMMISSION_PERCENT` in `packages/brands` and the per-income commission in `packages/lead-crm` have no reader left and go.
- Per-brand totals are approximate: a Payout with no Lead need not name a Brand.
