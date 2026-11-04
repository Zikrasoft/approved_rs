---
status: accepted, refined by ADR-0040 and ADR-0043; hand-entered Vehicles superseded for crawled Suppliers by ADR-0047
---

# The parts catalogue runs on our own data: staff-maintained Vehicles, no licensed feed

Decided 2026-10-20 with the owner, after the architecture review in [#355](https://github.com/Zikrasoft/approved_rs/issues/355) and the licensing research in `docs/research/tecdoc-licence-pricing.md` and `docs/research/vin-decode-cheap-alternatives.md`. Replaces the "licensed catalogue only" premise of [ADR-0037](0037-vehicle-fitment-ktype-vehicleidentifier-conditional-join.md) and all of [ADR-0038](0038-manual-fitment-curation-never-overwritten-by-sync.md).

**Decision:** carlab.rs sells a small catalogue of the most-requested BMW parts (pilot: N47/B47/B48, maintenance consumables), and every row in it is ours. The owner and his manager enter Parts, Categories, Vehicles and Fitments by hand in the Medusa admin. A Vehicle is one BMW type code (VIN characters 4-7, e.g. `35BG`), which is also the table VIN resolution reads. There is no automatic fitment feed, so the sync job, the stub feed and the `rejected` Fitment state are deleted. A wrong row is simply deleted.

**Why:** SEO needs indexable, prerendered pages, and a licensed source does not allow them on terms a small shop can live with. TecDoc's GTC v3.2 caps API caching at 30 days per user request and needs an "Open Access" licence for public pages. Its contract runs at least 2 years, its estimated cost is EUR 1,500 to 6,000 a year, and it forbids selling genuine BMW parts on its data at all. Parts-Catalogs has not confirmed it may redistribute BMW data. Our own data carries none of these limits. Consumables repeat heavily across BMW models, so a hand-kept catalogue of a few hundred Parts is feasible. Paid VIN decoders (Vincario, EUR 0.49 per lookup) return no more for BMW than a type-code table does, chassis and engine.

## Considered Options

- **License TecDoc and render from the API.** Rejected for now on cost, the 2-year lock-in, the 30-day cache and the Open Access requirement. It also covers aftermarket parts only, never genuine BMW.
- **A paid VIN decoder.** Deferred. The `VinDecoder` seam stays, so swapping it in later replaces one adapter.
- **Seed Vehicles from the `bimmerarchive-open-data` mirror.** Not as a bulk import: database rights on the mirrored data are unsettled, and it has no G-series rows. Staff may check single type codes by hand.

## Consequences

- Coverage only grows as staff add rows. A VIN with an unknown type code, or any request while Medusa is down, falls through to a Parts inquiry with the VIN pre-filled. VinLookup stays as a log of what customers search for, stamped with the decoder version.
- Until Inter Cars API access exists (#328), nothing has a price. The cart lives in the browser and is sent as a Parts inquiry Lead through the existing lead pipeline. A Medusa cart and order arrive together with prices.
- A Publish action in the admin runs translate, then build and deploy of carlab.rs, then a Typesense reindex. The reindex comes after the deploy, so search never points at pages that do not exist yet.
- If a licensed source is bought later, it gets a new ADR. ADR-0038's manual-versus-automatic rules are the starting point, not something to resurrect unchanged.
