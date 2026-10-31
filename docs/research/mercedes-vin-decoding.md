# Decoding European Mercedes-Benz VINs

Research date: **2026-10-20**. Companion to
[`vin-decode-cheap-alternatives.md`](vin-decode-cheap-alternatives.md), which
settled BMW on our own type-key table (VIN characters 4-7). Question: what in a
European Mercedes-Benz passenger-car VIN (C-Class W204/W205/W206, E-Class
W212/W213, A/B/CLA/GLA, GLC) can play the same role, so a staff-maintained
Vehicle row can be found from a customer's VIN?

## Answer

For the cars this shop will see most, characters **4-9** of a European
Mercedes VIN are the six-digit **Baumuster** (model designation), written
`205.004` in Mercedes literature and `205004` in the VIN. The first three digits
are the Baureihe (model series, `205` = C-Class W205 family), the last three
pick body, engine and drive (4MATIC has its own Baumuster). Character 10 is
**not** a model year in these VINs: in every Baumuster-style VIN observed it is
`1`, which German sources read as left-hand drive (`2` = right-hand drive), and
character 9 is not an ISO 3779 check digit. Character 11 is the plant, 12-17
the serial. The Baumuster is a usable equivalent of BMW's type key, but coarser
on one axis: it does not change at a facelift unless the engine does, and the
VIN carries **no year**, so a Vehicle row needs a production-date range that the
VIN alone cannot select. Two warnings: since 2019 new WMIs (`W1K` cars, `W1N`
SUVs) replace `WDD`/`WDC` with the same layout behind them, and some 2023+
European Mercedes VINs follow a **different, check-digit scheme** with no
Baumuster at 4-9, which our decoder must recognise and send to a Parts inquiry.
No open Baumuster dataset with a licence was found; staff enter rows by hand,
as for BMW.

## Source status

- **[P]** primary: an official register, government dataset or the vendor's own
  page or API, read in this session.
- **[S]** secondary: forum, reseller, encyclopedia or search-engine summary.
- **[NOT ESTABLISHED]** could not be verified from any available source.

No Mercedes document (EPC, WIS, datacard spec) describing the European VIN
layout was reachable without a dealer login, so the layout below rests on
secondary descriptions checked against real VINs in an official register.

## 1. WMIs

NHTSA vPIC `DecodeWMI`, called for each code **[P]**:

| WMI   | vPIC manufacturer / type                  | vPIC record created |
| ----- | ----------------------------------------- | ------------------- |
| `WDB` | Mercedes-Benz Cars, Mercedes-Benz/Maybach | 2015-04-17          |
| `WDD` | Mercedes-Benz Cars, passenger car         | 2015-04-17          |
| `WDC` | Mercedes-Benz Cars, MPV (SUVs)            | 2015-04-20          |
| `W1K` | Mercedes-Benz Cars, passenger car         | **2019-11-05**      |
| `W1N` | Mercedes-Benz AG, MPV (SUVs)              | **2019-11-05**      |
| `W1V` | no result in vPIC (`Count: 0`)            | n/a                 |

The 2015 dates are when vPIC's records were created, not when the WMIs were
first used. Wikibooks' WMI list **[S]** adds `W1V` (van), `W1T` (truck), `WDF`
(Citan/Vito/X-Class built in France and Spain) and `VSA` (Mercedes-Benz Spain).
So a European car built from late 2019 may open `W1K`/`W1N` where its
predecessor opened `WDD`/`WDC`, with the same layout behind the WMI (section 2).
Exact cut-over dates per model **[NOT ESTABLISHED]**, so the decoder must accept
both. `WDB` appears on older cars (W168, W203, W211 VINs in the BOE annex below).

## 2. Layout of the Baumuster-style VIN

Secondary descriptions (auto-preisliste.de, e-klasse-forum.de) **[S]** agree on:

| Pos.  | Content                     | Example `WDD2050041R316333` |
| ----- | --------------------------- | --------------------------- |
| 1-3   | WMI                         | `WDD`                       |
| 4-6   | Baureihe (model series)     | `205`                       |
| 7-9   | rest of Baumuster           | `004` (Baumuster 205.004)   |
| 10    | steering, `1` LHD / `2` RHD | `1`                         |
| 11    | plant letter                | `R`                         |
| 12-17 | serial number               | `316333`                    |

Checked against the 20 Mercedes VINs in the annex of the Spanish official
gazette BOE-A-2025-13788 (DGT flood-vehicle register, 2025) **[P]**:

- All 17 VINs whose characters 4-9 are six digits have `1` at position 10,
  consistent with Spanish left-hand-drive cars. None carries a model-year code
  there.
- Computing the ISO 3779 / 49 CFR 565 check digit, 1 of those 17 matches
  position 9 (about the 1-in-11 chance level), so position 9 is part of the
  Baumuster, not a check digit **[P, computed]**.
- Three VINs do **not** follow this layout: `W1K3G1CB9PJ403934`,
  `W1N9N0CB1RJ116426`, `W1VTCACZ5PU345914`. All three carry a valid check digit
  at position 9 and a year-like letter at 10 (`P`, `R` = 2023, 2024 on the
  North American table). Which models these are, and from when Mercedes uses
  this scheme in Europe, is **[NOT ESTABLISHED]**.

Plant letters per Wikibooks and forums **[S]**: `A`-`D` Sindelfingen, `F`-`H`
Bremen, `J` Rastatt; other letters unverified. Steering is in the VIN (position
10); market or country is not, beyond what WMI and plant imply
**[NOT ESTABLISHED]** for any finer market code.

North American Mercedes VINs use a different layout (series letter at 4, body
at 5, check digit at 9, year at 10); Wikibooks states its chart "is not
applicable to Mercedes-Benz products made for markets other than North America"
**[S]**. A grey-import US car in Serbia would therefore not decode with the
European rule.

## 3. Is the Baumuster a stable key?

Baumuster list for the W205 saloon from an engine reseller (meyermotoren.de)
**[S]**, excerpt:

| Model          | Baumuster                 | Engine        | Built                 |
| -------------- | ------------------------- | ------------- | --------------------- |
| C 220 BlueTEC  | 205.002, 205.003, 205.004 | OM 651.921    | 03.14-05.18           |
| C 220 d        | 205.014, 205.015          | OM 654.920    | 05.18-05.21           |
| C 220 d 4MATIC | 205.005                   | OM 651.921    | 04.15-05.18           |
| C 200          | 205.042                   | M 274.920     | 12.13-08.18           |
| C 200 4MATIC   | 205.043 / 205.079         | M 274 / M 264 | to 08.18 / from 08.19 |
| C 180          | 205.040                   | M 274.910     | 03.14-03.21           |

What this shows, with the source's own inconsistencies noted:

- **Engine is pinned.** Where the 2018 facelift replaced OM651 by OM654 or M274
  by M264, the Baumuster changed (205.004 to 205.014/015, 205.043 to 205.079).
- **4MATIC is pinned** (205.042 vs 205.043).
- **Facelift alone is not.** C 180 205.040 spans 2014-2021 with one engine, so
  pre- and post-facelift cars share a Baumuster; bumpers, lamps and some trim
  differ, and only a date can split them.
- **One model name, several Baumuster.** Three codes for C 220 BlueTEC (120 and
  125 kW are listed); what separates them **[NOT ESTABLISHED]**.
- **Body is likely the first suffix digit** (VIN character 7). That `0xx` =
  saloon, `2xx` = estate, `3xx` = coupe, `4xx` = cabriolet is commonly stated
  **[S]** but not checked here. Gearbox is not known to be encoded
  **[NOT ESTABLISHED]**.

So one Baumuster is roughly one series + body + engine + drive configuration,
like a BMW type key, but without a reliable model year.

Example decodes (VINs from BOE-A-2025-13788 **[P]**; model names from the
reseller table **[S]**):

| VIN                 | Series | Baumuster | Reads as                                |
| ------------------- | ------ | --------- | --------------------------------------- |
| `WDD2050041R316333` | 205    | 205.004   | C 220 BlueTEC saloon, OM651, LHD        |
| `WDD2050011R503373` | 205    | 205.001   | C 200 d family (engine per row varies)  |
| `W1K2062421F015673` | 206    | 206.242   | W206 family, model unverified, LHD      |
| `W1K2383231F177795` | 238    | 238.323   | E-Class coupe/cab. family, unverified   |
| `WDD1690071J290079` | 169    | 169.007   | A-Class W169, model unverified, Rastatt |

## 4. Free or cheap Baumuster mapping

| Source                                                | What it gives                                                                                  | Terms for automated use                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mercedes-Benz /developers "Vehicle Specification" API | Per-VIN model, engine, equipment **[P]**; "production year 2015 onwards", most markets **[S]** | OAuth B2B product, price not published **[P]**                                                           |
| Mercedes EPC / datacard via dealer                    | Baumuster, SA codes, dates                                                                     | Dealer/workshop access, no API for us                                                                    |
| NHTSA vPIC                                            | US-layout VINs only                                                                            | Free, public domain; useless for EU VINs                                                                 |
| German/English Wikipedia model pages                  | Engines, kW, years per model name **[P]**                                                      | CC BY-SA; no Baumuster table found for W205                                                              |
| meyermotoren.de and similar resellers                 | Baumuster tables **[S]**                                                                       | No API; copying their tables is not licensed                                                             |
| GitHub (`gh search` for Baumuster, W205)              | No Baumuster dataset found                                                                     | n/a                                                                                                      |
| mbtools.com, 7zap.com, lastvin.com                    | Per-VIN decode pages                                                                           | No public API or permission found; lastvin reserves rights under EU DSM Art. 4 in robots.txt. Not usable |

Paid generic decoders (Vincario and others) are covered in the BMW notes; none
was re-checked for Mercedes here.

## 5. Recommendation

1. **Identifier:** VehicleIdentifier type `mercedes-baumuster`, value the six
   characters 4-9 without a dot (`205004`), shown to staff as `205.004`. Keep it
   separate from BMW's `oem-type-code` so each decoder owns its keyspace.
2. **Decoder rule:** WMI in `WDB`, `WDD`, `WDC`, `W1K`, `W1N`; characters 4-9
   all digits; character 10 in `1`/`2`. Anything else (the 2023+ check-digit
   scheme, North American VINs, vans) is unresolved and falls through to a
   Parts inquiry with the VIN pre-filled, logged in VinLookup.
3. **Vehicle row attributes** (staff-entered): Baumuster, Baureihe and body
   chassis label (W205 / S205 / C205 / A205), model name (C 220 d), engine code
   (OM654.920), kW, fuel, 4MATIC yes/no, production-date range. Steering comes
   from VIN character 10 and belongs on Fitment, as for BMW.
4. **Facelift split:** a Baumuster that spans a facelift needs Fitments with a
   date range, and the storefront must ask "built before or after mm/yyyy?"
   because the VIN cannot answer it.
5. **Seed by hand** from the customer demand VinLookup records, checking each
   Baumuster on a datacard or EPC screen the owner already has; do not import a
   reseller table.

Caveats: the European layout rests on [S] sources validated against 17 real
VINs; a Mercedes primary document would firm it up. The new check-digit scheme
needs one decoded example (owner's EPC or the Vehicle Specification API) before
it can be supported.

## Sources

- NHTSA vPIC `DecodeWMI` API, `https://vpic.nhtsa.dot.gov/api/` [P]
- BOE-A-2025-13788, Annex I (via `legalize-dev/legalize-es` mirror of the BOE) [P]
- Mercedes-Benz Vehicle Specification,
  `https://connectivity.mercedes-benz.com/products/vehicle-specification` [P]
- Wikibooks, Mercedes-Benz VIN codes and WMI list [S]
- auto-preisliste.de FIN guide; e-klasse-forum.de FIN thread [S]
- meyermotoren.de, C-Klasse (W205) model list [S]
