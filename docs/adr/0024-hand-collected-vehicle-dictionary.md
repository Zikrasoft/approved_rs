---
status: superseded
---

# Vehicle fitment uses a hand-collected dictionary and stores car names, not ids

Superseded by [ADR-0028](0028-no-vehicle-dictionary-until-fitment-is-required.md): the dictionary was deleted before launch because no product type requires fitment. The considered options below still stand.

In `main` since PR #34. Owner decisions 2026-09-28/29.

A custom Medusa `vehicle` module holds make → model → generation with years, collected by us from cited sources; the admin picks from selects and the server validates fitment against it. `metadata.fitment` keeps `{make, model, yearFrom, yearTo}` by name so the package, storefront and tests needed no change; an entry must sit inside one generation. Renaming, narrowing or deleting an entry a product depends on returns 409 naming the products. A public `GET /store/vehicles` (shape fixed by `vehicleTreeSchema`) is baked into the car picker at build.

## Considered Options

- **Vehicle data APIs** (auto-data.net, Wheel-Size, CarQuery, carapi, api-ninjas, DAT/Eurotax): they give vehicle specs, not which filter/pads/battery fits. auto-data.net's REST terms also forbid permanent storage.
- **TecDoc**: effectively the only source of real parts fitment; enterprise contract, no public price. A separate, later owner decision. Scraped "TecDoc alternatives" are a legal risk.
- **A separate automotive module (Part, OEM number, cross-reference, Compatibility → Product)**: the right model eventually, but premature with a small single-supplier catalog. Design it together with the TecDoc decision, triggered by a TecDoc contract, a second supplier of one part, or OEM/cross-number search. It would also replace names with generation ids as the link.

## Consequences

Renaming a make does not cascade to products; the next product save catches it.
