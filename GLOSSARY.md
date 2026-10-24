# CarLab Parts Catalog

The auto-parts domain for carlab.rs's VIN-based parts shop ([wayfinder map #320](https://github.com/Zikrasoft/approved_rs/issues/320)): matching a vehicle to the parts that fit it, sourced from multiple suppliers at different markups. The repo's only domain with a glossary so far. If another app's domain needs its own vocabulary later, split into a `GLOSSARY-MAP.md` then rather than overloading this one.

## Language

**Part**:
The canonical internal entity for one physically-interchangeable thing (one position or function, e.g. "oil filter, BMW B47/B48 engines"), merging the vehicle manufacturer's OEM number and every aftermarket brand's equivalent under a single identity. A Part is what fitment data points at and what search resolves to from any of its numbers; it is never itself a purchasable line.
_Avoid_: Article, SKU, Артикул (each already means something different to TecDoc, Intercars, and BMW's own catalogue)

**PartIdentifier**:
One typed, branded number that resolves to a Part, unique on `(brand, normalized value)` and never on bare `value`; its `type` is an attribute, not part of the key. `type` is `oem` (the vehicle manufacturer's own number, e.g. BMW `11 42 8575211`), `manufacturer-number` (an aftermarket brand's own number for an equivalent item, e.g. Mann-Filter `HU 816 x`), or `ean` (a barcode, when one exists). `brand` is always present, even when unknown (an unbranded or house-sourced item carries brand `generic`/`unknown` rather than a null), because two different brands can issue overlapping number strings, and without the brand in the key that's a silent collision, not a near-miss. Photos belong to the PartIdentifier, not the Part: a photo shows one brand's physical item with its number printed on it, so an equivalent never borrows another brand-number's photo.
_Avoid_: part number (ambiguous about whose number), supplier SKU (that's SupplierOffer's job, not an identifier of the part itself)

**SupplierOffer**:
One supplier's or warehouse's sellable line for a specific `PartIdentifier` (brand-variant) of a Part: their own article id, price, stock quantity, and lead-time tier (in-stock / N-days / etc, broken out per physical warehouse where the supplier's own stock feed does that). A supplier selling both the Mann-Filter and the Bosch version of the same Part creates two SupplierOffers, one per `PartIdentifier`, each its own purchasable line and its own price; the storefront never hides which brand-variant it's selling behind one generic "buy" button. Our own warehouse is a supplier like any other for this purpose.
_Avoid_: Listing, Offer (bare); always qualify with "supplier" or "warehouse"

**Brand**:
A manufacturer whose part numbers we list (BMW for genuine parts, Mann-Filter, Mahle, Bosch), kept as one canonical name with each supplier's spellings as aliases. A PartIdentifier's brand is always one of these.
_Avoid_: Make (that is a vehicle manufacturer), manufacturer (bare)

**Supplier adapter**:
The connection to one supplier (Inter Cars, our own warehouse, a future distributor) that lists its catalogue and quotes price and stock. It feeds SupplierOffers and proposes new PartIdentifiers; it never owns catalogue data.
_Avoid_: integration, connector, feed (bare)

**Enriched**:
Said of a brand-number page that carries enough of our own data to be worth indexing: a Category plus a Fitment or a published equivalent. Pages that are not enriched are buyable but `noindex`.
_Avoid_: complete, published (a non-enriched page is published too)

**Category**:
A customer-facing group of Parts that do the same job (oil filter, cabin filter, spark plugs). Every Part belongs to exactly one Category. Staff maintain the list and its descriptive text, and a Vehicle's Parts are browsed per Category.
_Avoid_: Group, Hauptgruppe (that is BMW's own catalogue structure, which this shop does not reproduce)

**Make**:
A vehicle manufacturer whose cars the shop covers (BMW, Mercedes-Benz). Its VINs are recognised by their first three characters.
_Avoid_: Brand (that word is taken by a PartIdentifier's brand)

**Series**:
A make's model line as customers name it (BMW 3 Series, Mercedes C-Class), spanning several generations.
_Avoid_: Range, family

**Chassis**:
One generation and body style of a Series under the manufacturer's own code (F30 sedan, F31 touring, W205 sedan, S205 estate).
_Avoid_: Platform, generation (bare), body code

**Model**:
A named variant on one Chassis as customers search for it (F30 320d, W205 C 220 d). It groups the Vehicles that share that name across engines and years, and it is the unit a model page is built for.
_Avoid_: Trim, type (a type code identifies a Vehicle, not a Model)

**Engine**:
One engine as its manufacturer codes it (B47D20O0, OM654), belonging to an engine family (B47, OM654) that parts are often matched by.
_Avoid_: Motor, power unit

**Vehicle**:
One manufacturer configuration: a Model with one Engine, drive and market, as the manufacturer's own code identifies it (a BMW type code, a Mercedes Baumuster). Not one physical car: thousands of cars and VINs share one Vehicle. Staff create Vehicles by hand, as demand reaches a new code (see [ADR-0040](docs/adr/0040-one-catalog-module-vehicle-reference-tables.md)).
_Avoid_: Car, Vin, Model (a Model spans several Vehicles)

**VehicleIdentifier**:
One code a vehicle vocabulary uses for a Vehicle, typed by that vocabulary (`bmw-type-code`, `mercedes-baumuster`, later others). A Vehicle may carry codes from several vocabularies; a VIN resolves through them.
_Avoid_: KType (bare), type code stored anywhere but here

**Fitment**:
The statement that one Part fits one Vehicle, with a quantity and, where it matters, a Position, optionally narrowed by a production-date range, steering side or gearbox, or qualified by a free-text note. Every Fitment is entered by staff. **Ambiguity** is not stored: it is what a customer sees when one Vehicle has several Parts in the same Category and Position, or a Fitment with a note, and it is shown as "confirm your variant", never resolved by a guess.
_Avoid_: "fits" (as a flat boolean), rejecting a row (a wrong Fitment is deleted)

**Position**:
Where on the Vehicle a fitted Part goes: axle (front or rear) and side (left or right), each only when it matters.
_Avoid_: location, slot, callout (that is a diagram number in a manufacturer catalogue)

**Category field**:
One characteristic a Category's Parts are described by (wiper length in mm, oil viscosity, oil approvals), with an immutable key, a type and, for selects, a fixed list of options. A Part's values are checked against its Category's fields.
_Avoid_: attribute (bare), property, spec, custom field

**Requirement**:
What an Engine, Chassis or Vehicle demands of a Part in one Category, stated on a Category field (allowed options or a numeric range) with the quantity of Parts to buy, never a volume, e.g. "B47: engine oil with approval BMW LL-04, one 5 l can". Universal Parts reach a Vehicle through Requirements instead of Fitments.
_Avoid_: spec (bare), recommendation, fitment (a Requirement names no Part)

**Supersession**:
A manufacturer replacing one part number with another. When both fit either way, the old number stays an identifier of the same Part, marked superseded; when the replacement is one-way, the old Part is "replaced by" the new one.
_Avoid_: substitute, alternative, cross-reference (that is an aftermarket equivalent, a PartIdentifier)

**Maintenance kit**:
Everything a Vehicle needs for a routine service, assembled on the fly from its Fitments and Requirements in the Categories marked for it. It is never stored.
_Avoid_: bundle, set, package

**VinLookup**:
A record of one customer-typed VIN, the Vehicle it resolved to (if any) and what the VIN revealed about that physical car, such as steering side, with the resolving decoder's name and version. It logs which cars customers look for, so unresolved codes show staff which Vehicles to add next. **Not** a VehicleIdentifier: a VIN is one physical car, not a configuration.
_Avoid_: storing a VIN on Vehicle, treating VinLookup as the canonical vehicle record

**Parts inquiry**:
A customer's request for the Parts they picked (with their contact and, when known, VIN and Vehicle) sent to staff as a Lead, because those Parts have no price yet. Staff answer it with a price by hand. It is not an Order: an Order exists only once Parts carry SupplierOffer prices.
_Avoid_: Order, quote, price request
