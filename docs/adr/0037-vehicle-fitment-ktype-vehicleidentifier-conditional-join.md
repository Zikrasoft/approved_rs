---
status: accepted
---

# Vehicle/fitment: a canonical Vehicle keyed to external catalogues, a conditional Fitment join

Decided 2026-10-17, as part of [wayfinder map #320](https://github.com/Zikrasoft/approved_rs/issues/320) (the VIN-based parts shop for carlab.rs).

A `Part` (see [ADR-0035](https://github.com/Zikrasoft/approved_rs/blob/main/docs/adr/0035-part-identity-one-canonical-part-brand-keyed-identifiers.md)) has to attach to something on the vehicle side, and the available fitment data sources don't agree on what that something is: TecDoc links by **KType** (its own vehicle-variant id, not a VIN — a VIN converts to a KType first, lossily, and the conversion is itself sometimes ambiguous), while an OEM catalogue (BMW's own EPC data, or a redistributor) carries its own type code plus production-date and steering/gearbox criteria on top.

**Decision:** `Vehicle` is a canonical internal entity for one vehicle _configuration_, not one physical car — thousands of identically-specced cars share one Vehicle row regardless of how many different VINs they carry. It is sourced the same way `Part` is: `VehicleIdentifier` rows reference external, licensed catalogue vocabularies (`ktype` for TecDoc, `oem-type-code` for an OEM catalogue), never a hand-maintained dictionary. The `Part`↔`Vehicle` join, `Fitment`, carries the narrowing criteria (production-date range, steering side, gearbox type) itself, rather than splitting `Vehicle` into one row per attribute combination — a single TecDoc KType is already coarse (gearbox/steering-dependent parts return multiple candidates), and multiplying `Vehicle` rows to chase that coarseness would duplicate the external vocabulary without resolving it. Ambiguity is therefore not a stored flag: it's what happens when a customer's resolved vehicle data doesn't carry enough detail to pick one `Fitment` row out of several candidates, and the storefront must surface that as "confirm your variant," never a silent guess.

A customer's own VIN is **not** a `VehicleIdentifier`. A VIN identifies one physical car; many different VINs share one `Vehicle` configuration, so storing a VIN as a `Vehicle`-level identifier would make a single `Vehicle` accumulate an unbounded number of unrelated customer VINs. Instead, `VinLookup` is a separate cache: raw VIN string → resolved `Vehicle` + decode metadata + timestamp.

**"Search by model" (no VIN) is in scope from day one**, not deferred — the owner's call. This falls out of the `Vehicle`/`VehicleIdentifier` model for free: browsing by make/model/engine/year is browsing the same KType/OEM-type hierarchy `Vehicle` already indexes, no VIN decode required.

**Customer accounts ("my garage") are explicitly out of this decision's scope**, raised live by the owner mid-session wanting the architecture to "leave room" for it. `VinLookup` is the natural future attach point for a saved vehicle once accounts exist, but whether/how accounts work at all is a separate, not-yet-resolved wayfinder ticket — this ADR commits to nothing about auth, and `Vehicle`/`VehicleIdentifier`/`Fitment`/`VinLookup` carry no customer reference themselves.

## Considered options

- **No canonical `Vehicle` entity — match fitment live against decoded VIN attributes.** Rejected: TecDoc's KType and an OEM catalogue's own type code are controlled external vocabularies, not something to re-derive from scratch per request; a canonical `Vehicle` is the same shape of decision ADR-0035 already made for `Part` and for the same reason (one identity, many sources pointing at it).
- **Split `Vehicle` finely enough (one row per date/steering/gearbox combination) so `Fitment` needs no extra criteria.** Rejected: multiplies `Vehicle` into near-duplicate rows per attribute combination and still doesn't resolve TecDoc's own KType-level coarseness — the ambiguity moves, it doesn't disappear.
- **Store a customer's VIN as a `VehicleIdentifier`.** Rejected: conflates "which configuration is this" (shared, many-to-one) with "whose specific car is this" (one VIN, one car) in the same table.

## Consequences

This reverses part of [ADR-0028](https://github.com/Zikrasoft/approved_rs/blob/main/docs/adr/0028-no-vehicle-dictionary-until-fitment-is-required.md): fitment is now required by this map's destination, so a vehicle-side model exists again — but it is not the free-text, hand-entered dictionary ADR-0028 correctly rejected; it references controlled external vocabularies the same way `PartIdentifier` does. Customer accounts remain an open, separate question; `VinLookup`'s shape is deliberately ready to carry a future customer reference without a redesign, but nothing here decides whether accounts get built.
