---
status: accepted
---

# Crawled Vehicles are cars and vans, named through one Make table

Decided 2026-10-29 for [#425](https://github.com/Zikrasoft/approved_rs/issues/425), before the first production Import, because [ADR-0049](0049-catalogue-urls-are-frozen-and-redirect.md) freezes every slug at creation. Refines the reference-row rules of [ADR-0047](0047-crawled-applicability-becomes-fitments.md).

**Decision:**

- **The shop keeps passenger cars and vans.** Construction, agricultural, industrial, marine and motorcycle vehicles are dropped, and so are trucks and buses: carlab.rs is a car service, and the owner never asked for them. Iveco stays for the Daily van, Isuzu for its pick-ups.
- **One table decides which Makes exist and what they are called.** `CAR_MAKES` in `apps/auto-service-shop/src/lib/suppliers/makes.ts` lists each car or van Make under its display name (`BMW`, `Volkswagen`, `Škoda`, `Mercedes-Benz`, `Citroën`) with the spellings the crawled sites print for it (`SKODA`, `VOLVO CARS`, `KIA MOTORS`, `DS AUTOMOBILES`, `LDV LIMITED`, `LAMBORGHINI AUTOMOBILI`, `VW (VOLKSWAGEN)`). A spelling resolves first through the Make spellings staff and the seed keep, then through the table, also with its parenthesised owner removed (`IVECO (MAGIRUS)`, `RAM (Chrysler)`). A row whose Make resolves to neither fits nothing and creates no Make, so a new car Make reaches the shop by a line in the table or by a spelling staff add in the admin. The production seed files every spelling in the table as an alias on each crawled Supplier that lists cars.
- **A crawled row maps to Series, Chassis and Model only by what names the car.** On MANN-FILTER and FILTRON the Series is the model line the site groups the rows under (`5` from `5 (E60/E61)`), the Chassis is the row's codes in parentheses outside the designation, all upper-case codes, with a shortened sibling filled out (`E60/61` is `E60` and `E61`), or else the line's codes, and the Model is the designation the site links and its parentheses (`535i (E60/61)`, `2.0 TFSI (TTS) (FV)`). The lines of the row's tooltip (gearbox codes, `Prefilter`, `→ 11/24`) become the Fitment's note and never reach a name or a slug. Engine codes, power, displacement and years stay on the Engine and Vehicle as before. The parentheses stay in the Model name because a VIN reaches a Mercedes through the Baumuster listed there ([ADR-0050](0050-a-vin-reaches-crawled-vehicles-through-the-baumuster-their-models-list.md)).
- **A bare `LAMBORGHINI` on MANN-FILTER and FILTRON is the tractor maker** (both sites print the MANN+HUMMEL catalogue) and is dropped at parsing; the car maker is `LAMBORGHINI AUTOMOBILI` there.

## Considered Options

- **A list of off-road makers to drop** (the rule this replaces). Rejected: the #422 Import still created 363 Makes, most of them trucks, buses and machines, because the sites list hundreds of such makers and add more. A list of what the shop sells is short and closed.
- **Read the vehicle kind from the page.** Rejected: neither site prints one per row.
- **Use the bare link text as the Model name.** Rejected: it drops the Baumuster the VIN lookup reads, and the body code that tells `218 d (F22)` from `218 d (F23)`.

## Consequences

- A truck or bus line sold under a car Make (Mercedes-Benz Actros, Ford Cargo, Iveco Stralis, Toyota Dyna) still comes in, because the sites name no kind and the Make is right. Dropping those needs a rule per Series.
- A tooltip note now makes the Fitment ambiguous on the storefront ("confirm your variant"), which is what the note says.
- An upper-case group that is not a chassis code (`(CNG)`, `(TRACTOR)`) still reads as one; on the #422 crawl such groups are a handful against hundreds of real codes without digits (`FV`, `CHC`, `TGA`), so the rule keeps letters-only codes.
- A database that already holds a Make under a non-car name, such as a local copy of the #422 Import, keeps fitting to it, because a known spelling or name wins over the table. Production starts empty.
- A Make missing from the table is invisible to the crawl until someone adds it, which is safe: nothing reaches a frozen slug by accident.
