---
status: accepted
---

# No vehicle dictionary until a product type with required fitment ships

Decided 2026-09-30 on issue #73, after the simplification review of the shop (#64) and the owner's launch answers (#68). Removed in this commit, against `main`.

Batteries are the only product type at launch and their `fitment` rule is `optional`. So nothing at launch reads the dictionary: the 409 orphan guard guards zero rows, the car picker narrows zero results, and `GET /store/vehicles`'s one consumer was a build-time call in the storefront's catalog loader. That is ~2,500 lines — a Medusa module with three models and a migration, admin CRUD with an orphan guard, a store route, a seed, a hand-collected fixture and a storefront picker — carrying a schema, a migration and an admin page nobody uses.

**The dictionary is deleted, not shrunk to a constant.** The fitment _plumbing_ stays: the registry's `FitmentRule`, `FitmentEntry` and `fitmentSchema` in `@podbor/shop-catalog`, the admin spec widget's fitment field, and the storefront's fitment filter. Validation drops to **shape only** — `fitmentSchema` still refuses a blank make, a year outside 1950–2100 and years running backwards — and the admin types the make and model as free text instead of picking from selects. `CarPicker` does not ship at launch. The collected tree is parked, unreferenced, at `docs/research/vehicles.json`.

This supersedes [ADR-0024](0024-hand-collected-vehicle-dictionary.md), whose considered options stand: the dictionary comes back — in whatever form the trigger argues for — when a product type with **required** fitment ships, or when ADR-0024's own trigger fires (a TecDoc contract, a second supplier of one part, OEM or cross-number search).

## Considered Options

- **Keep the Medusa module.** What `main` holds. Rejected: a migration, an admin page and a public route in production for a dictionary with no consumer, and a database whose first shape already carries tables nobody queries.
- **Shrink it to a constant in `@podbor/shop-catalog`.** Cheaper than the module and the storefront could import it without a round trip, but it is still a list to maintain, still ships to the browser, and it fixes the shape of a dictionary we will design against a real trigger. Rejected as configuration for a single caller that does not exist yet.
- **Keep the dictionary and drop only the picker.** Leaves the module's cost with no visible return at all.

## Consequences

- Two products can spell the same car differently («VW Golf» and «Volkswagen Golf»), and nothing catches it. Accepted: under ten SKUs, all typed by the owner, and the fitment filter is not what sells a battery. The admin field says to match the spelling of earlier products.
- Nothing narrows the catalog by car at launch. The storefront's `car.ts` and the fitment leg of `shopFilter` stay in place and read an empty selection, so a future picker has something to write to.
- No down-migration is needed: no database exists yet (the VPS is not ordered, #69), and the vehicle tables were never created anywhere.
