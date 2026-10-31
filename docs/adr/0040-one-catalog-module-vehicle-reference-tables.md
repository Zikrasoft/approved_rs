---
status: accepted
---

# One catalog module: vehicle reference tables, an identifier table per vocabulary, a swappable VIN decoder chain

Decided 2026-10-20 with the owner, refining [ADR-0039](0039-own-catalogue-data-staff-maintained-vehicles.md) once Mercedes-Benz joined BMW in the first launch. Research: `docs/research/vin-decode-cheap-alternatives.md` (BMW) and `docs/research/mercedes-vin-decoding.md`.

**Decision:**

- **One Medusa module.** Make, Series, Chassis, Model, Engine, Vehicle, VehicleIdentifier, Category, Part, PartIdentifier and Fitment live in a single `catalog` module, so every relation between them is a real Postgres foreign key. Supplier/SupplierOffer and VinLookup stay outside it.
- **Staff-maintained reference tables.** Make → Series → Chassis → Model → Vehicle, plus an Engine table holding the full engine code and its family. They replace free-text columns, so a typo cannot split a page or break a bulk attach.
- **Vehicle** is one manufacturer configuration (BMW type code, Mercedes Baumuster). Its codes are rows in **VehicleIdentifier**, typed per vocabulary (`bmw-type-code`, `mercedes-baumuster`, later `ktype` or a paid decoder's id), unique on (type, value). A new make or source adds rows, not columns.
- **Fitment criteria** are production dates, gearbox and steering. Steering is back because Mercedes encodes it in the VIN (character 10), not in the Baumuster.
- **Deletion.** Deleting a Part or a Vehicle cascades to its Fitments and identifiers. A reference row cannot be deleted while anything points at it.
- **Translations** are a JSON column on the translatable entity (Series, Category, Part).

**VIN decoding is a chain of adapters behind one interface.** The input is a VIN. The output is the make, the vehicle identifiers found, and what is known about this physical car (steering, and later production date and gearbox), or "unresolved".

- Today's adapters are our own per-make rules, picked by WMI:
  - BMW (`WBA` etc.): characters 4-7.
  - Mercedes (`WDB`/`WDD`/`WDC`/`W1K`/`W1N`): characters 4-9 when character 10 is `1` or `2`. The 2023+ scheme with no Baumuster is unresolved.
- A paid decoder is added as a further adapter in the chain, called only for VINs our rules cannot resolve. If it knows more (production date, gearbox), fewer customers are asked to confirm a variant, and nothing downstream changes.
- Which adapters run is configuration.
- VinLookup records the decoder's name, version and raw answer, and a lookup from an older version is resolved again.

## Considered Options

- **Separate Part and Vehicle modules joined by Medusa module links** (the current code). Rejected: no foreign keys, so the review found orphans and dangling Fitments.
- **A single type-code column on Vehicle.** Rejected once a second make arrived. Each make, and any future paid source, has its own vocabulary.
- **One Vehicle per steering side for Mercedes.** Rejected: it duplicates every Baumuster row, when the VIN already says the side.

## Consequences

- Mercedes facelifts keep their Baumuster, and neither make's VIN carries a model year. Date-dependent parts therefore always reach "confirm your variant" until a decoder that returns the production date sits in the chain.
- No open Baumuster dataset exists, so Mercedes Vehicles are entered by hand, exactly like BMW's.
