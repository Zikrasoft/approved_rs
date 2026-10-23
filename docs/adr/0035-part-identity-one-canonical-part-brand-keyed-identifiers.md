---
status: accepted
---

# Part identity: one canonical Part, brand-keyed identifiers, per-brand supplier offers

Decided 2026-10-16, as part of [wayfinder map #320](https://github.com/Zikrasoft/approved_rs/issues/320) (the VIN-based parts shop for carlab.rs).

carlab.rs's new parts catalog pulls data from sources that each number the same physical part differently: BMW's own OEM catalogue, TecDoc's aftermarket cross-references, and each supplier's (Intercars, our own warehouse, future suppliers) own article numbering. The owner asked, live, "what even is an артикул: a unique id in the shop, or in the world?" (see [#321](https://github.com/Zikrasoft/approved_rs/issues/321)). It's neither: see `GLOSSARY.md` for the resolved terms (`Part`, `PartIdentifier`, `SupplierOffer`).

**Decision:** the catalog's canonical unit is `Part`: one interchangeability position, never a single brand's number. Every number that resolves to it (OEM, aftermarket-brand, EAN) is a `PartIdentifier` keyed on the compound `(type, brand, value)`, so two manufacturers reusing the same string never collide. A supplier's own article id is not a `PartIdentifier`; it lives on `SupplierOffer`, which is scoped to one specific `PartIdentifier` (brand-variant), not to the `Part` as a whole, so two brands of the same Part sold by one supplier at different prices are two separate purchasable lines. Brand is mandatory even when unknown (`generic`), never nullable.

## Considered Options

- **OEM number as the sole canonical key**, aftermarket equivalents shown only as non-purchasable "see also" suggestions. Rejected: our own warehouse and other suppliers routinely stock only the aftermarket brand, never the OEM part, and that stock needs to be a real purchasable line, not a dead end.
- **One independent Part per manufacturer-brand number**, cross-references as a loose graph with no shared parent. Rejected: "find everything that fits this position" would mean walking a reference graph instead of reading one entity, exactly the lookup both the storefront and Typesense need to be fast and simple.
- **Supplier's own article id as a fourth `PartIdentifier` type.** Rejected: it only ever means something paired with `(supplier, price, stock)`, which is already `SupplierOffer`'s job; a separate identifier row would duplicate that relationship.

## Consequences

Fitment linking (which `Part` fits which vehicle) is explicitly out of this decision's scope. TecDoc's own vehicle-to-part matching can return multiple `Part` candidates for one position (gearbox/steering-dependent parts). That ambiguity must be a first-class "needs confirmation" state on whatever Vehicle/fitment entity a follow-up wayfinder ticket defines, not silently resolved to a guess. See the "Fitment candidate" forward reference in `GLOSSARY.md`.
