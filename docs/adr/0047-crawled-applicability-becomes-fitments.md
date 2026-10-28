---
status: accepted, slugs frozen by ADR-0049
---

# Crawled applicability becomes Vehicles and Fitments at import

Decided 2026-10-27 with the owner ([#401](https://github.com/Zikrasoft/approved_rs/issues/401), parent #391). Supersedes, for crawled Suppliers only, the "staff enter every Vehicle and Fitment by hand" rule of [ADR-0039](0039-own-catalogue-data-staff-maintained-vehicles.md), and the staging of their applicability under [ADR-0043](0043-supplier-adapters-catalogue-import-page-per-brand-number.md).

**Decision:**

- **An adapter reports vehicles as facts, not text.** A Supplier article may carry `vehicles`: make, model, variant, chassis codes, engine codes, ccm, kW, fuel, body style, years and free-text limits, zod-validated in the adapter contract. The crawled sites fill it by structured parsing: MANN-FILTER and FILTRON from their application table columns, bilstein from the JSON its vehicle list loads. No AI reads applicability; nothing these sites print needed it. `applicability` stays the staged, unpublished text channel for a Supplier whose data may come from TecDoc.
- **The import matches a Vehicle before it creates one.** A row fits an existing Vehicle of the same make (by slug) whose engine code equals the row's after dropping spaces and dashes, or is its family (bilstein names `N52`, MANN `N52 B30A`), whose kW equals the row's (or either is unknown), whose years overlap the row's, and whose Chassis code shares a code with the row (`E82/E88` matches `E82`). A row without chassis codes uses its model name as the code. One Vehicle is matched or created per engine code a row lists; a row with no engine code fits nothing.
- **Missing reference rows are created**: Make, Series (the row's model), Chassis (its codes joined by `/`), Model (the variant), Engine (family = the code's letters and first digits) and Vehicle, each stamped with the Supplier as `source`, so deleting a catalogue source removes them. A created Vehicle has no VehicleIdentifier: the sites print no type code, and VIN resolution is unchanged.
- **Chassis body style and Engine fuel are now optional**, because MANN prints neither. The storefront leaves the line out when one is unknown; the admin still asks for both.
- **Fitments**: one per matched Vehicle, stamped with the Supplier, its limits joined into the note. A Requirement conflict skips it. Staff deleting a Fitment now soft-deletes it, and the import never recreates a Fitment that exists or was deleted for that Part and Vehicle, so a wrong row stays gone. Manual Fitments are never changed.
- **Imported Part names are Russian.** AI writes the name from the source facts at creation and again only when the source's own name changes (`part.source_name` keeps the last one), so Publish translates names like descriptions. A hand edit still stops renaming.

## Considered Options

- **AI reads every applicability row.** Rejected: all three sites give columns or JSON; AI would add cost and invented values where parsing is exact.
- **Match on model name too.** Rejected: MANN and bilstein name models differently (`125i (E82/E88)` against `125 i`), so the same car would split into two Vehicles. The chassis code they share is the tighter key.
- **A default body style and fuel instead of nullable columns.** Rejected: the car page would state a wrong fact.
- **A tombstone table for deleted Fitments.** Rejected: Medusa already soft-deletes, and every raw query on Fitment already filters `deleted_at`.

## Consequences

- Making `body_style` and `fuel` nullable relaxes two NOT NULL constraints. A rollback to the previous image fails to parse only the crawled rows that left them empty.
- Staff who delete a crawled Vehicle get it back on the next import, with its Fitments; deleting single Fitments is the way to correct one.
- Two different cars sharing make, chassis code, engine, kW and years become one Vehicle. That is the same configuration by our own definition.
