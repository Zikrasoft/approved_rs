# CarLab Parts Catalog

The auto-parts domain for carlab.rs's VIN-based parts shop ([wayfinder map #320](https://github.com/Zikrasoft/approved_rs/issues/320)): matching a vehicle to the parts that fit it, sourced from multiple suppliers at different markups. The repo's only domain with a glossary so far — if another app's domain needs its own vocabulary later, split into a `GLOSSARY-MAP.md` then rather than overloading this one.

## Language

**Part**:
The canonical internal entity for one physically-interchangeable thing — one position or function (e.g. "oil filter, BMW B47/B48 engines") — merging the vehicle manufacturer's OEM number and every aftermarket brand's equivalent under a single identity. A Part is what fitment data points at and what search resolves to from any of its numbers; it is never itself a purchasable line.
_Avoid_: Article, SKU, Артикул (each already means something different to TecDoc, Intercars, and BMW's own catalogue)

**PartIdentifier**:
One typed, branded number that resolves to a Part: the triple `(type, brand, value)`, never bare `value`. `type` is `oem` (the vehicle manufacturer's own number, e.g. BMW `11 42 8575211`), `manufacturer-number` (an aftermarket brand's own number for an equivalent item, e.g. Mann-Filter `HU 816 x`), or `ean` (a barcode, when one exists). `brand` is always present, even when unknown — an unbranded or house-sourced item carries brand `generic`/`unknown` rather than a null — because two different brands can issue overlapping number strings, and without the brand in the key that's a silent collision, not a near-miss.
_Avoid_: part number (ambiguous about whose number), supplier SKU (that's SupplierOffer's job, not an identifier of the part itself)

**SupplierOffer**:
One supplier's or warehouse's sellable line for a specific `PartIdentifier` (brand-variant) of a Part: their own article id, price, stock quantity, and lead-time tier (in-stock / N-days / etc, broken out per physical warehouse where the supplier's own stock feed does that). A supplier selling both the Mann-Filter and the Bosch version of the same Part creates two SupplierOffers — one per `PartIdentifier` — each its own purchasable line and its own price; the storefront never hides which brand-variant it's selling behind one generic "buy" button. Our own warehouse is a supplier like any other for this purpose.
_Avoid_: Listing, Offer (bare) — always qualify with "supplier" or "warehouse"

**Vehicle**:
The canonical internal entity for one vehicle _configuration_ — not one physical car. Thousands of BMW 320ds with identical engine/trim/body share a single Vehicle; their owners' individual VINs do not multiply it. Mirrors `Part`'s shape: licensed external catalogues (TecDoc, BMW's own EPC) are the source of truth for what configurations exist, never a hand-maintained dictionary — that's exactly what [ADR-0028](docs/adr/0028-no-vehicle-dictionary-until-fitment-is-required.md) correctly rejected for free-text data, and this is not that.
_Avoid_: Car, Vin — a Vehicle is a configuration, not a specific physical car and not a VIN (see `VinLookup`)

**VehicleIdentifier**:
One typed reference from a Vehicle to an external catalogue's own vehicle-variant id: `type` is `ktype` (TecDoc's KType: brand/model/type/years) or `oem-type-code` (the manufacturer's own EPC type code, e.g. BMW's). Mirrors `PartIdentifier` — a Vehicle can carry more than one, since TecDoc's and an OEM catalogue's vehicle vocabularies don't line up 1:1.
_Avoid_: KType (bare) — always through a VehicleIdentifier row, never assumed to be the only vocabulary in play

**Fitment**:
The join between one `Part` and one `Vehicle` for one position, carrying the criteria that further narrow it: a production-date range, steering side, gearbox type — because a single Vehicle (even one TecDoc KType) can still need different Parts at the same position depending on these. Criteria live on the Fitment row, not on Vehicle — splitting Vehicle itself per date/steering/gearbox combination would multiply it into near-duplicates without resolving KType's own coarseness. **Ambiguity is not a stored flag**: it emerges when a customer's actual car doesn't carry enough resolved detail (date, steering, gearbox) to pick a single matching Fitment row from several candidates — the storefront must show this as "confirm your variant," never silently guess one.
_Avoid_: "fits" (as a boolean) — a Fitment row's applicability is conditional, not flat

**VinLookup**:
A cached resolution of one customer-typed VIN string to the `Vehicle` it decodes to (plus the decode's own metadata and timestamp). **Not** a `VehicleIdentifier` — a VIN identifies one physical car, not a configuration, so storing it as a Vehicle-level identifier would make one Vehicle accumulate thousands of unrelated VIN strings from unrelated customers. VinLookup is where a raw VIN belongs instead: on a cart/order for staff reference, and later as the attach point for a customer's saved vehicle ("my garage"), once accounts exist — see the accounts ticket, not decided here.
_Avoid_: storing a VIN directly on Vehicle, or treating VinLookup itself as the canonical vehicle record
