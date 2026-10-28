---
status: proposed
---

# A VIN reaches crawled Vehicles through the Baumuster their Models list

Proposed 2026-10-28 for [#427](https://github.com/Zikrasoft/approved_rs/issues/427), awaiting the owner. Refines the VIN side of [ADR-0047](0047-crawled-applicability-becomes-fitments.md), which left crawled Vehicles without a VehicleIdentifier.

**Decision:** a VIN still resolves first through a VehicleIdentifier. When none matches, a Mercedes Baumuster is looked up in the names of crawled Models: MANN-FILTER and FILTRON print it in parentheses (`E 300 (212.054/254)` lists `212054` and `212254`). Only parentheses count, because the sites print engine codes such as `OM 222.167` outside them, and only Models of the decoded Make. A truck's `Series: 956.003/033` sits outside them too, so it is not read. One Vehicle found resolves the VIN to it. Several found are never narrowed by guessing: the lookup stays unresolved and names them as `vehicle_ids`, with `model_slug` when they share one Model, and the storefront picks the nearest place that has a page. A VinLookup's stored Vehicle is answered again without a new match only when it carries a manufacturer VehicleIdentifier, so a later Import that adds a second Vehicle under the same Baumuster turns the answer ambiguous instead of leaving the first one cached. Nothing is written back as a VehicleIdentifier, because one Baumuster often lists several crawled Vehicles and identifiers are unique per value.

A BMW VIN carries only its type code, which no crawled site prints, so a BMW VIN still reaches only hand-entered Vehicles. Reaching crawled BMWs needs a type-code table from outside the crawl; the options are in `docs/research/vin-decode-cheap-alternatives.md`, and choosing one is the owner's call.

## Considered Options

- **Match on the Baureihe, the Baumuster's first three digits, against Chassis codes.** Rejected: on the #422 Import most Baureihen span many Models, so the answer is the Make, and a Baureihe matching one Vehicle would be a guess about its engine.
- **Store the Baumuster as a VehicleIdentifier at Import.** Rejected for now: a Baumuster shared by several crawled Vehicles cannot be one unique identifier.
