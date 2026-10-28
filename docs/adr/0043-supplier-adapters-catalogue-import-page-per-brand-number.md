---
status: accepted, crawled applicability published as Fitments by ADR-0047, import moved out of Publish by ADR-0048
---

# Suppliers feed the catalogue through adapters; a page per brand-number; import, build and reindex on Publish

Decided 2026-10-21 with the owner, refining [ADR-0039](0039-own-catalogue-data-staff-maintained-vehicles.md): the catalogue must hold as many parts as possible, each with its own prerendered SEO page and a supplier price, without tying the shop to one supplier. Research: `docs/research/intercars-ecat-api.md`, `docs/research/acat-vs-parts-catalogs.md`, `docs/research/catalogue-auto-fill.md`.

**Decision:**

- **The catalogue is ours; suppliers only feed it.** A supplier is wired in through an adapter with two calls: list its catalogue page by page, and quote price and stock for a list of its articles. Inter Cars is the first adapter; another supplier, or our own warehouse, is another adapter.
- **Matching key.** An imported article is matched to a PartIdentifier by (Brand, normalized manufacturer number), never by the supplier's own article id. A match only adds or updates that supplier's SupplierOffer. A miss creates the PartIdentifier, under a Part of its own, stamped with its source.
- **Brand is a staff-maintained reference table** with per-supplier aliases (`MANN-FILTER`, `MANN` → Mann-Filter), and supplier categories map to our Categories in an admin table. Only mapped categories and listed Brands are imported.
- **A page per brand-number,** at a URL that never changes (e.g. `/sr/parts/p/mann-hu6004x/`), showing its own SupplierOffers, best first, without supplier names. This replaces "one page per Part". The Part is the group of interchangeable brand-numbers, shown on each page as "equivalents"; merging two groups changes only that block, so no redirects are needed.
- **Indexing.** A new page is buyable and searchable at once but `noindex` and out of the sitemap until it is enriched: it carries something beyond its brand and number: a description, any attribute value, a Fitment or a published equivalent (`enrichmentGaps` in `@podbor/catalog-contract`). A Category is not required (spec #391, 2026-10-25), so a described but unclassified Part ranks too, and a universal Part such as an oil reaches the index through its attributes without a Fitment of its own.
- **Supplier data that may come from TecDoc** (OE cross references, vehicle applicability, images) is kept in staging and not published until the supplier confirms in writing that we may. A field a person has edited is never overwritten by an import. Staff upload their own photos per brand-number (ordered) and one image per Category in the admin.
- **Rhythm.** The admin's Publish button imports new articles, prices and stock, builds and deploys the site and reindexes search. There is no nightly run (2026-10-22): cart and checkout re-quote price and stock live from the supplier, and each build bakes the current prices into the pages' structured data, so an unattended run would only add a way to ship bad supplier data overnight. The nightly chain in spec #360 and issues #373, #376 and #379 is replaced by this button. Selling, the closed beta and what a build bakes while the shop is closed are in [ADR-0045](0045-offer-cart-closed-beta-order-lead.md).
- **No supplier left.** A brand-number with no SupplierOffer keeps its page (indexed if enriched) with "price on request", which opens a Parts inquiry.
- **Online OEM catalogues** (Parts-Catalogs, ACAT) are staff lookup tools only. Their terms forbid building a catalogue or public pages from their data, however we pay.

## Considered Options

- **The supplier's catalogue as our catalogue** (pages and identity keyed by Inter Cars articles). Rejected: it ties URLs, SEO and data to one supplier.
- **One page per Part with redirects on merge.** Rejected by the owner in favour of stable brand-number pages.
- **Index every imported page at once.** Rejected: thousands of number-and-price pages risk being judged thin content.
- **ACAT or Parts-Catalogs as the catalogue source.** Rejected: forbidden by their licences.

## Consequences

- What makes a page indexable is our enrichment (Fitment, equivalents, attributes, texts), so SEO grows with staff work and with confirmed supplier data.
- SSG of tens of thousands of pages must fit the build time limit; measure it on a prototype before relying on it.
- Inter Cars' catalogue fields, publication rights, Serbian availability and rate limits are still unknown (#328).
