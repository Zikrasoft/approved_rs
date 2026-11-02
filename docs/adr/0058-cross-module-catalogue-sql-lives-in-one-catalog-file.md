# Cross-module catalogue SQL lives in one catalog file

The shop runs every module on one Postgres (ADR-0040). Three places read catalog tables in raw SQL from outside the catalog module: the publish module (what is published, which numbers are listed, how many Parts each car has), the vin-lookup module (which unresolved VIN codes have no Vehicle) and the orphan sweep after Publish and source deletions. Doing those joins in JavaScript through each module's service would bring back the whole-table reads that ran out of memory before, so we keep the single database and the joins.

What we change is where they live. Every statement that crosses a module seam sits in `apps/auto-service-shop/src/modules/catalog/cross-module-sql.ts`, owned by the catalog module whose columns they name. `cross-module-sql.spec.ts` plans each one against a freshly migrated database, so a renamed catalog column fails CI instead of a request.

Two rules that used to be written in several places now have one owner each:

- **Listed.** Publish writes `published_number.listed` once: a number is listed unless its Part is replaced by a Part with a published number, or it is superseded and its Part has a current published number. The search index, the car-page counts and `/store/part-pages` (as the contract's `listed`, null from an older shop, where carlab.rs falls back to its own rule) all read that column.
- **Requirement fit.** Which Parts a car's Requirements match is computed when the search index and the car counts are built, so it reaches the site on Publish like a Fitment does. A Requirement match counts toward a page only from a Category where at least two Parts match (`MIN_REQUIREMENT_MATCHES_FOR_PAGE` in `@podbor/catalog-contract`); with two, a Model, a Vehicle or a Model category gets a page even without Fitments.

Consequences: a catalog schema change has one file to check. A Requirement edit no longer shows in search before the next Publish. The requirement pairs ride to the counts query as bound arrays, which is fine at today's size and has a `TODO:` naming its ceiling.
