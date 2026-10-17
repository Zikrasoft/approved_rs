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

**Fitment candidate** _(forward reference — owned by a future ticket, recorded here because it constrains that ticket)_:
TecDoc's vehicle-to-part linkage (by KType, not VIN directly) can return more than one Part for a single position when the right one depends on an attribute TecDoc doesn't fully disambiguate (gearbox type, steering side). Whatever Vehicle/fitment entity gets designed next must carry this as a first-class, visible "needs confirmation" state — never silently resolved to a guess.
