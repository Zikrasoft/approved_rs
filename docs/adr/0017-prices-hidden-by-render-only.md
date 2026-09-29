# Service prices are hidden by removing the render, not the data

The owner decided (2026-09-13) to show no prices on details.rs and none on carlab.rs service pages. Only the rendering was removed; the YAML `priceFrom` fields and zod schemas stay, because the schemas are `.strict()` with required fields and deleting keys would drag in `registry.test.ts` and the translate script. Turning prices back on is a revert. CarLab's dinar prices are deferred until 2026-12-01. Where a price is shown (the shop), the currency is RSD.
