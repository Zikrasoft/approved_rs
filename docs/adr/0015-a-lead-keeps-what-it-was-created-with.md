# A lead keeps the brand and commission rate it was created with

The commission rate is per business (`COMMISSION_PERCENT` in `packages/brands`, bound as `DEFAULT_COMMISSION_PERCENT` in each app's `src/lib/crm.ts`) and is copied onto the lead at creation, like `brand`. Changing a default or renaming a brand never rewrites history, so past deal commissions stay what was agreed.

## Consequences

- The bot's per-brand summary can show an old brand name next to a new one while old (e.g. test) leads remain in the blob.
- The bot can override the rate per lead; the default only affects new leads.
