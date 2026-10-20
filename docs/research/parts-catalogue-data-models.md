# How established parts catalogues model their data

Research date: **2026-10-20**. Question: how do TecDoc, ACES/PIES, the OEM
parts catalogues (BMW ETK, Mercedes EPC) and shop fitment plugins model parts,
vehicles and fitment, and what does that mean for our own hand-maintained
BMW + Mercedes catalogue as decided in
[ADR-0039](../adr/0039-own-catalogue-data-staff-maintained-vehicles.md) and
[ADR-0040](../adr/0040-one-catalog-module-vehicle-reference-tables.md)?
Licensing, sourcing and platform choice are already covered in
[`fitment-data-sourcing.md`](fitment-data-sourcing.md),
[`parts-shop-opensource-landscape.md`](parts-shop-opensource-landscape.md),
[`platform-survey.md`](platform-survey.md) and
[`tecdoc-licence-pricing.md`](tecdoc-licence-pricing.md); this file is only
about data shape. Terms follow [`GLOSSARY.md`](../../GLOSSARY.md).

## Answer

Every serious catalogue has the same skeleton we already chose: a controlled
vehicle hierarchy ending in one configuration id (TecDoc `KTypNo`, VCdb
`BaseVehicle`/`Vehicle`, BMW type key, Mercedes Baumuster), a controlled part
type list (TecDoc Generic Article, PCdb Part Terminology), brand-qualified part
numbers with OE cross references, and one link row per part x vehicle that is
**narrowed by coded criteria**, not split into more vehicles. Where they differ
from us is in the extras on that link and on the part: quantity, fitting
position, footnotes, supersession, kits (parts lists), and typed part
attributes with a per-part-type dictionary. Both standards also say, in their
own words, that structured criteria beat free text and that you should not
"over-map". For a small, staff-kept, consumables-first catalogue the
recommended additions now are few and cheap: a normalised search form of every
PartIdentifier, superseded numbers kept as ordinary identifiers, a quantity on
Fitment, a uniqueness guard on Fitment, an admin bulk attach by Engine, and
deleting the dead `source`/`status` columns. Position, notes, part specs, kits
and universal parts wait for the first Category that needs them. Assembly-group
search trees, diagrams, country restrictions and a criteria dictionary are not
worth building at our size.

## Source status

- **[P]** primary: the standard's own document, the vendor's own API spec, an
  official manual, real files in that format, or source code read directly.
- **[S]** secondary: third-party description or reverse engineering.
- **[NOT ESTABLISHED]** could not be verified from any available source.

Field and table names below are quoted from the cited source; nothing is
paraphrased into a name.

## 1. TecDoc (TecDoc Data Format 2.7)

Source for this whole section: **[P]**
[TecDoc Data Format, Data Format Version 2.7, document 2.0.31, 26.01.2026](https://dwnld.aws.tecalliance.com/TecDoc/Downloads/TecDoc-Data-Format.pdf)
(207 pages, read in full text). Tables are numbered fixed-width files; reference
data has `BrandNo` 9999, supplier data carries the supplier's `BrandNo`.

- **Vehicle hierarchy.** `100 Manufacturer` → `110 Vehicle Model Series`
  (`KModNo`, `ManNo`, `ModYFrom`/`ModYTo` as `YYYYMM`) → `120 Vehicle Types`
  (`KTypNo`, `KModNo`, `ModYFrom`, `ModYTo`, `KW`, `HP`, `ccmTech`, `Cyl`,
  `EngType`, `DriveType`, `BrakeType`, `FuelType` …). Engines are their own
  table `155 Engines`, joined to types through
  `125 Engine Number Allocation to Vehicle Types` with its own date range. A
  KType is therefore one configuration with typed technical columns, the same
  idea as our Vehicle.
- **Other vehicle vocabularies** hang off the KType as allocation tables:
  `121 KBA Type Allocation`, `123 Allocation of Type Mine Numbers`,
  `126 Swiss Type Number`, `127 Netherlands Number Plate`,
  `129 Austrian NatCodes`. That is our VehicleIdentifier, done as one table
  per vocabulary.
- **Part types.** `320 Generic Articles` (`GenArtNo`, `NormTermNo`, `AssGrpNo`,
  `UsageNo`, flags `OK_PC`, `OK-Eng`, `OK-Universal`, `OK-Ind`).
  `324 Assembly Groups` and `325 Purpose of Use` classify them; the browse tree
  is separate: `301 TecDoc Search Structure` (`Node_ID`, `Node_Parent_ID`,
  `Level`, no depth limit since 2014) plus
  `302 Allocation of GenArt to Search Structure`. An article is put in a type
  through `211 Article to Generic Article Allocation`.
- **Articles and numbers.** `200 Article Table` is keyed by `ArtNo` + supplier
  `BrandNo`, and the spec says "Use only Uppercase characters in the article
  number". OE cross references are `203 Reference Numbers` (`ArtNo`, `ManNo`,
  `RefNo`, `ReferenceInfo`, `Additive`), where `Additive` lets a kit reference
  a single OE part. `207 Trade Numbers` (`TradeNo`, old name `GebrNr`, the
  "usage number") are short codes a catalogue can search by. `209 GTIN` holds
  barcodes.
- **Supersession.** `204 Superseding Articles`: `ArtNo` supersedes `SupersNo`,
  both must exist in `200`, and "Recursion is not permitted (i.e. article A
  supersedes B, B supersedes C, C supersedes A)". It is a directed graph
  between a supplier's own articles, not across brands.
- **Linkage.** `400 Article Linkage`, primary key
  `LnkTargetType, LnkTargetNo, GenArtNo, ArtNo, SeqNo`. The target type says
  what the article is linked to: "2 = PC-Ktype-No, 7 = ManID-No, 14 =
  EngineNo, 16 = CV-Type-No, 19 = Axle-Type-No". So TecDoc can link to an
  **engine**, not only a vehicle type. The same article may be linked to the
  same target several times (`SeqNo`), but those rows "must differ in any
  relevant point" (criteria, information, description). There is no quantity
  or position column on `400`.
- **Linkage criteria and notes.** `410 Linkage attributes` adds `CritNo` /
  `CritVal` per linkage row; `401 Search Information Texts` adds text per
  linkage; `432` adds per-linkage graphics. Criteria are defined once in
  `050 Criteria Table` with a `Type` (`A`lphanumeric, `N`umeric, `D`ate,
  `K`ey, `V` without value), a key table for `K`, and flags saying where each
  may be used (`OKArticle`, `OKPC`, `OKEngine`, `PartLstCrit`). Which criterion
  codes fitting position, and whether quantity per vehicle is expressed as a
  criterion, is in the key tables, which this document does not list
  **[NOT ESTABLISHED]**.
- **Article criteria.** `210 Article Criteria` holds vehicle-independent
  attributes (`CritNo`, `CritVal`, `FirstPage` for immediate display).
  `328 Mandatory Criteria` and `329 Proposed Criteria` say which criteria each
  Generic Article must or should carry, and whether only on the article
  (`OnlyArt`) or only on the linkage (`OnlyLnk`). Free text goes to
  `206 Article Information`, and the spec states "The usage of the data table
  (-> 210) for such information is always preferred."
- **Parts lists and kits.** `205 Parts Lists` (`ArtNo`, `PartNo`,
  `PartGenArtNo`, `Quantity`), nestable, no recursion, plus
  `208 Parts List Criteria`. The spec's own example is a **pseudo article**
  "Oil XY 10W40" whose components are the package sizes, linked to vehicles
  once so that a new size reaches every vehicle automatically.
  `222 Accessory Lists` is separate.
- **Status, packaging, deletion.** `212 Country-Specific Article-data` carries
  `QuantUnit` (packing unit), `QuantPerUnit`, `ArtStat` and `StatusDat`. Every
  supplier table has `DeleteFlag` fixed at `0`: suppliers send full deliveries
  (`001 Header` has `Full` and a brand-wide delete flag), and the change log
  says delta deliveries "are not an option anymore". Reference data deletions
  are announced in `005` with `ReplacementNo` and `Reason`. Almost every table
  carries `CountryCode` + `Exclude` for country restrictions.

## 2. ACES / PIES / VCdb / PCdb / Qdb (North America)

- **Reference databases.** VCdb (vehicles, "Over 40 Vehicle Attributes"),
  PCdb (part types, "over 36,000 product descriptions"), Qdb (coded
  qualifiers), PAdb (product attributes, "over 239,000"), Brand Table.
  **[P]** [Auto Care, "An Introduction to ACES and PIES" (ACPN 2022)](https://www.autocare.org/docs/default-source/events/event-materials/acpn/01---acpn22-bootcamp-final.pdf).
- **Vehicle model.** `basevehicle` is (`yearid`, `makeid`, `modelid`);
  `vehicle` adds `submodelid` and `regionid`; each system is a separate config
  joined many-to-many: `engineconfig` (`enginebaseid`, `enginedesignationid`,
  `aspirationid`, `fueltypeid` …) via `vehicletoengineconfig`, and likewise
  `vehicletotransmission`, `vehicletobrakeconfig`, `vehicletobodystyleconfig`,
  `vehicletosteeringconfig`, `vehicletodrivetype`. **[S]** table names from the
  VCdb loader schema in
  [autopartsource/aceslint](https://github.com/autopartsource/aceslint) (MIT,
  last push 2017), a vendor's transcription, not Auto Care's own DDL. This is
  how they avoid combinatorial explosion: the vehicle stays coarse and every
  system is a side table, not a multiplied row.
- **Application record.** Auto Care's own example **[P]** (same deck):
  `<App action="A" id=… ref=…>` with `<BaseVehicle id/>`,
  `<Qual id="2341"><text>with Air Conditioning</text></Qual>`, `<Qty>`,
  `<PartType id/>`, `<MfrLabel>`, `<Position id/>`, `<Part>`. Quantity and
  position live **on the application**, part type too. Qdb exists because
  "With Air Conditioning", "w/ A.C." and the rest are all qualifier 2341: it
  "Eliminates free-text qualifier expressions" and centralises translation.
  PCdb pairs part types with valid positions (1684 Disc Brake Pad Set: 22
  Front, 103 Front Left, 30 Rear …); PCdb `codemaster` has `positionid` **[S]**
  (same loader schema).
- **Narrow only as far as needed.** In a real ACES 3.1 file from the aceslint
  repo **[P]**, all 6,512 `App` records use `BaseVehicle`; only 266 add
  `SubModel` and 24 `EngineBase`, while 2,779 carry a free-text `<Note>`
  (e.g. "carbon version"). Amazon's ingestion guide says "Don't over-map ...
  only give us the fitment information necessary", accepts either
  `BaseVehicle` or Year/Make/Model, and removes a fitment only by an explicit
  delete record that "must match exactly the original addition record". **[P]**
  [Amazon, Providing ACES Data to Amazon Automotive](https://m.media-amazon.com/images/G/01/Automotive/Providing_ACES_Data_to_Amazon_Automotive.pdf).
- **PIES** is the item side. The deck draws its segments as Item,
  Description, Price, Extended Product Info, Attribute, Package, Kits,
  Interchange, Digital Assets and Hazmat (labels, not element names), with
  item fields such as `PartNumber`, `BrandAAIAID`,
  `ItemQuantitySize UOM="EA"`, `PartTerminologyID` and `ACESApplications`
  (`Y`/`N`). **[P]** same deck. PAdb defines attributes **per part type** with
  valid values (Friction Material Composition: Metallic, Semi-metallic,
  Ceramic …).
- **Universal parts.** ACES has no "fits all" record; an item simply has no
  applications, and PIES flags whether it has any (`ACESApplications`). That a
  universal item is handled by `N` there is our reading **[S]**. Supersession
  element names in PIES were not checked **[NOT ESTABLISHED]**.

## 3. OEM catalogues (BMW ETK, Mercedes EPC)

- **Mercedes EPC, official manual.** **[P]**
  [Mercedes-Benz, "EPC Brief Instructions"](https://mwa.mercedes-benz-clubs.com/wp-content/uploads/sites/25/2014/11/EPC_Brief_Instructions.pdf):
  the user enters the VIN so "the vehicle datacard will then be evaluated as
  well", then picks group (46 Steering) and subgroup (105 Steering wheel and
  steering wheel lock); the picture shows numbered items and "All the part
  numbers of the whole subgroup are displayed in the parts list". Correct
  selection needs "Information from the Datacard", "Code information
  (passenger cars)" and "Footnotes must be evaluated", footnotes carrying
  "ES1 code, ES2 code, ident. end numbers, etc.". ES2 is "mandatory when
  ordering parts that depend on color or the equipment installed". So
  applicability is a **condition on a parts-list line** (codes, footnotes,
  ident number ranges), resolved against the car's own datacard, not against
  a configuration id.
- **BMW ETK.** No BMW-published schema exists. The reverse-engineered
  [emdzej/etkx `docs/SCHEMA.md`](https://github.com/emdzej/etkx) (no licence
  stated, decompiled from the dealer client) **[S]** lists: `w_fztyp`
  (`fztyp_typschl` type key, `fztyp_motor`, `fztyp_getriebe`,
  `fztyp_lenkung`, `fztyp_karosserie`), `w_bildtaf` diagrams per main/function
  group, `w_btzeilen` lines (`btzeilen_pos`, `btzeilen_sachnr`,
  `btzeilen_menge`, `btzeilen_bedkez`), `w_bed` conditions (`bed_sala` SA
  option code, `bed_mospid`) with `w_bed_afl` for production dates,
  `w_teileersetzung` for replacements, `w_teil` with `teil_entfall_dat`
  (discontinuation), and `w_kompl_satz`/`w_kompl_einzelteil` (by name, kits;
  semantics **[NOT ESTABLISHED]**). Note that `w_fztyp` carries gearbox and
  steering beside the type key, consistent with the BMW type key already
  implying both (see
  [`vin-decode-cheap-alternatives.md`](vin-decode-cheap-alternatives.md)).
- **Pattern.** OEM catalogues are diagram-first: the unit is a position on an
  illustration, carrying quantity and a condition expression (dates, SA codes,
  footnotes). Fitment is computed by evaluating conditions per car, which is
  why it needs the car's option list, which our VIN decoders do not have.

## 4. Shop implementations

- **vehiclefits** (Magento/PrestaShop, OSL-3.0, last push 2014) **[P]**
  [`library/VF/Schema/Generator.php`](https://github.com/vehiclefits/library):
  configurable levels as `elite_level_%d_%s` tables (`id`, `title`), a
  `elite_%d_definition` table of level combinations, and `elite_%d_mapping`
  (`entity_id`, the level ids, `universal`, `related`, `price`). The
  `universal` column's own comment: "if there is a row with this flag set for a
  product ( entity_id ) then it should be returned universally for all
  vehicles". Enumerated rows, plus a bypass flag.
- **eBay Inventory API** **[P]**
  [sell_inventory_v1 OpenAPI](https://developer.ebay.com/api-docs/master/sell/inventory/openapi/3/sell_inventory_v1_oas3.json):
  `Compatibility` has `compatibleProducts`; each `CompatibleProduct` names a
  vehicle by `productIdentifier` (`epid`, `gtin` or `ktype`) or by name/value
  `compatibilityProperties` (make, model, year, trim, engine), plus free-text
  `notes` "to specify the placement of the part on a vehicle". Multi-vocabulary
  vehicle ids, position as a note.
- **Medusa** has no fitment recipe; its
  [bundled products recipe](https://docs.medusajs.com/resources/recipes/bundled-products/examples/standard)
  **[P]** models a kit as `Bundle` + `BundleItem` (`quantity` default 1),
  linked to products by module links.
- Magento Amasty, WooCommerce, PrestaShop and BigCommerce plugins, Spree,
  Vendure, Shopware: covered in
  [`parts-shop-opensource-landscape.md`](parts-shop-opensource-landscape.md)
  and [`platform-survey.md`](platform-survey.md); all are a flat
  Year/Make/Model(/Engine) mapping table. No public schema with attribute-based
  fitment (oil spec, wiper length) was found **[NOT ESTABLISHED]**.

## 5. Cross-cutting patterns and pitfalls

1. **Brand-qualified numbers.** TecDoc keys articles by `ArtNo` + `BrandNo`
   and OE references by `ManNo` + `RefNo`; ACES/PIES by brand code + part.
   Bare numbers collide. We already key `(type, brand, value)` (ADR-0035).
2. **Normalised numbers.** TecDoc forces uppercase; customers type
   `11428575211`, `11 42 8 575 211` or `HU816X`. Searching needs a normalised
   form (uppercase, spaces, dots, dashes and slashes stripped) beside the
   display value. Without it the unique index also lets `HU 816 x` and
   `HU816X` coexist as two identifiers.
3. **Supersession is a graph per brand, never cyclic.** TecDoc forbids cycles
   explicitly. When old and new numbers are interchangeable both ways, they are
   one Part in our model and the old number is just another identifier. A
   one-way replacement (new fits old cars, old does not fit new) is two Parts
   with different Fitments.
4. **Typed attributes per part type, not free EAV.** TecDoc (`050` + `210` +
   `328`) and PAdb both keep a dictionary of attributes **per part type**,
   typed, with valid values. A generic key/value table without that
   dictionary is the failure mode; typed columns per Category do not scale to
   dozens of Categories. Middle ground for us: one JSON column validated by a
   per-Category zod schema in code.
5. **Structured criteria over notes.** Both standards say it outright
   (TecDoc on `206` vs `210`, Qdb "Eliminates free-text"). Real data still
   leans on notes (43% of Apps in the sample file). Notes must be translated
   per locale; criteria need no translation.
6. **Quantity and position belong on the link.** ACES `Qty`/`Position` sit on
   the App; ETK has `btzeilen_menge` on the line. Position matters for us
   because our Ambiguity rule ("several Parts in one Category for one
   Vehicle") would otherwise flag front and rear brake pads as a variant to
   confirm.
7. **Do not multiply vehicles.** VCdb keeps systems in side tables; TecDoc
   repeats a linkage with different criteria (`SeqNo`); Amazon says don't
   over-map. Our ADR-0037/0040 already chose criteria on Fitment over more
   Vehicles.
8. **Rule vs enumerated fitment.** Everyone stores enumerated rows (TecDoc per
   KType, ACES per BaseVehicle, plugins per YMM). The scaling tool is linkage
   to a coarser target (TecDoc `LnkTargetType` 14 = engine) or bulk tooling,
   never stored rules. Consumables follow the engine (B47 oil filter), so the
   cheapest equivalent is a bulk attach by Engine that writes ordinary rows.
9. **Deletes are explicit and exact.** TecDoc ships full deliveries; Amazon
   applies ACES deletes only when they match the add exactly. For hand-kept
   data, hard delete is fine; the risk is SEO, since a deleted Vehicle or
   Category can remove a prerendered page.
10. **Provenance.** ACES headers stamp `VcdbVersionDate`, `PcdbVersionDate`,
    `QdbVersionDate`; TecDoc stamps data releases. Our data has one source
    (staff), so per-row provenance is only "who and when".

## 6. Gap table

Ours = ADR-0040 as decided. The current code
(`apps/carlab-shop/src/modules/{part,vehicle,vin-lookup}/models/*.ts`) still
predates it: separate modules, free-text `make`/`model`/`engine_code` on
`vehicle`, no Category, an identifier enum of `ktype` and `oem-type-code`,
`fitment.part_id` as text, and `source` / `status` (`active`, `rejected`) on
`fitment`. Medusa adds `created_at`, `updated_at` and `deleted_at` to every
table and builds its indexes with `WHERE deleted_at IS NULL` (seen in our
migrations) **[P]**.

| Pattern                                            | Ours                                              | Recommendation                                                                         |
| -------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Vehicle hierarchy as reference tables              | ADR-0040 present; code missing                    | **Now**, as decided                                                                    |
| Configuration id + several vocabularies            | Present (VehicleIdentifier); code enum outdated   | **Now**: enum to `bmw-type-code`, `mercedes-baumuster`                                 |
| Part type list (Generic Article, PCdb)             | Category in ADR-0040; code missing                | **Now**, as decided                                                                    |
| Brand-qualified numbers                            | Present                                           | Keep                                                                                   |
| Normalised search number                           | Missing                                           | **Now**: `value_normalized`, unique on `(type, brand, value_normalized)`               |
| Supersession                                       | Missing                                           | **Now** as extra `oem` identifiers on the same Part; directed graph never              |
| Linkage criteria (dates, gearbox, steering)        | Present, structured                               | Keep; no criteria dictionary                                                           |
| Repeated linkage must differ (TecDoc `SeqNo` rule) | Missing: no unique index on `fitment`             | **Now**: unique on part, vehicle and all criteria (`NULLS NOT DISTINCT`)               |
| Linkage to engine, not only vehicle                | Excluded (Fitment is Part x Vehicle)              | **Now** as admin bulk attach by Engine/Chassis writing rows; engine-level rows never   |
| Quantity on the link                               | Missing                                           | **Now**: nullable integer on Fitment (spark plugs, coils)                              |
| Position on the link                               | Missing                                           | **Later**, with the first brake or wiper Category; Ambiguity then keys on position too |
| Footnotes / linkage notes                          | Missing                                           | **Later**, translatable, only when no criterion fits                                   |
| Typed part attributes per part type                | Missing                                           | **Later**: JSON `specs` + per-Category zod schema; generic EAV never                   |
| Mandatory attributes per part type (TecDoc `328`)  | Missing                                           | **Later**, falls out of the same zod schema                                            |
| Kits / parts lists / pseudo articles               | Missing                                           | **Later** (service kits, oil in several sizes)                                         |
| Universal / vehicle-independent parts              | Missing                                           | **Later**: a Part with no Fitment lists only on its Category page; bypass flag never   |
| Attribute-based fitment (oil spec, wiper length)   | Missing                                           | **Later**: oil spec on Engine + Part spec, still written as rows                       |
| Packaging quantity, article status                 | Missing                                           | **Later**, with prices (SupplierOffer)                                                 |
| Search tree / assembly groups / diagrams, callouts | Deliberately excluded (GLOSSARY: not Hauptgruppe) | **Never**                                                                              |
| SA / option-code conditions                        | Excluded; no decoder gives SA codes               | **Never** while VIN decoding stops at type code/Baumuster                              |
| Country restrictions                               | Excluded                                          | **Never** (one market)                                                                 |
| Hard delete with cascade                           | Present (ADR-0040)                                | Keep; check the SEO page fallout on delete later                                       |
| Feed provenance (`source`, `rejected`)             | Code has it; ADR-0039 removed the feed            | **Now**: drop both columns                                                             |
| Who/when audit                                     | `created_at`/`updated_at` only                    | **Later**, author id if two editors start overwriting each other                       |

## Recommendations

**Adopt now** (each is a column, an index or an admin action, not a subsystem):

1. A normalised form of every PartIdentifier value, used for search and in the
   unique key, with the typed form kept for display.
2. Superseded OEM and aftermarket numbers stored as more identifiers on the
   same Part when they are interchangeable both ways; a one-way replacement is
   a second Part.
3. `quantity` (nullable) on Fitment.
4. A unique index on Fitment over part, vehicle and every criterion, so two
   identical rows cannot exist (TecDoc's "must differ in any relevant point").
5. An admin bulk attach "this Part fits every Vehicle with Engine X (and
   Chassis Y)", writing ordinary Fitment rows. This is where consumables save
   most typing.
6. While implementing ADR-0040, delete `fitment.source` and `fitment.status`,
   which only served the removed sync (ADR-0039).

**Adopt later, on a named trigger:** position on Fitment (first positional
Category, and the Ambiguity rule must then group by position), translatable
Fitment notes, Part `specs` JSON with per-Category schemas, kits, universal
parts, oil-spec matching, article status and packaging units.

**Never:** a criteria dictionary in the database, assembly-group search trees,
diagrams and callouts, SA-code conditions, country restrictions, stored fitment
rules, and a "fits all vehicles" flag that bypasses Fitment.
