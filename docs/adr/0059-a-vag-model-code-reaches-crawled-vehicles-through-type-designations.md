---
status: accepted
---

# A VAG model code reaches crawled Vehicles through the type designations their Chassis carry

Decided 2026-11-02. Extends the decoder chain of [ADR-0050](0050-a-vin-reaches-crawled-vehicles-through-the-baumuster-their-models-list.md) and [ADR-0051](0051-a-bmw-type-code-reaches-crawled-vehicles-through-open-type-key-data.md) to Volkswagen, Audi, Skoda, SEAT and Cupra.

**Decision:** the `vag-model-code` decoder reads the make from the WMI (`WVW`, `WVG`, `WV1`, `WV2`, `WV3`, `1VW`, `3VW`, `3VV` Volkswagen; `WAU`, `WA1`, `WUA`, `WU1`, `TRU` Audi; `TMB` Skoda; `VSS` SEAT and Cupra) and the model code from VIN characters 7 and 8. The code is looked up in `apps/auto-service-shop/src/lib/vin/vag-model-codes.json`, a committed table of one row per code and generation: make, model, generation, the generation's type designations, years, market and the public sources the row comes from. A VIN reaches a Vehicle, first, when staff gave the Vehicle that code as a `vag-model-code` VehicleIdentifier, and otherwise when the Vehicle belongs to the row's make, its Chassis code holds a token that starts with one of the row's type designations (the crawl names Chassis like `5G1/BA5` or `8V1/8VK/8VM/8VS`), and the model year from character 10 falls in both the row's years and the Vehicle's, each widened by one year because sources and crawls mix production and model years. As in ADR-0050, exactly one Vehicle resolves the VIN; several stay unresolved and are named as `vehicle_ids`. `VSS` stands for both SEAT and Cupra, so a code only Cupra uses records the lookup as Cupra, and any other code as SEAT while still matching Vehicles of both.

**A model code names a generation, not a Vehicle.** Every engine of a Golf VII carries `AU`, so the code is not offered for bulk linking on the Unresolved VINs screen: a link would make every Golf VII VIN resolve to the Vehicles linked first. Staff may still give one Vehicle the code in the Vehicle editor where a generation has only that Vehicle. The screen shows what the table says about the code; the fix for an unmatched one is a Chassis code or a table row.

**Provenance:** each row lists its sources. They are the Wikibooks VIN code pages for Volkswagen and Audi (CC BY-SA, North American codes from 2010 on), Audi Japan's 2023 list of VIN ranges per model, Skoda Storyboard's VIN article, Club VeeDub's VIN reference, English and German Wikipedia for type designations and years, the Meyer Motoren vehicle catalogue (which English Wikipedia cites for type designations) for the three-character types a generation's bodies carry, and public VIN records (two or more per code where no reference list exists). Nothing is inferred from a type designation alone: Golf VII is type 5G but its VIN code is AU, Octavia III is type 5E but its VIN code is NE.

## Considered Options

- **Match crawled Model names.** Rejected: most VAG Model names in the crawl are an engine (`2.0 TDI 16V`); the type designation sits on the Chassis.
- **Narrow several Vehicles by engine or power.** Not possible from characters 7 and 8; the engine letter in character 5 is market-specific and documented only for North America.
