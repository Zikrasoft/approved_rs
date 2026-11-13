---
status: accepted
---

# Parts hubs are Series, and a Model or Vehicle is a scoped search

Decided 2026-11-13 with the owner, before the shop opens. Refines [ADR-0049](0049-catalogue-urls-are-frozen-and-redirect.md) and [ADR-0061](0061-make-pages-gather-content-by-the-catalogue-make-slug.md).

**Decision:**

- **The indexable parts pages under a Make are Series pages.** carlab.rs builds `/{locale}/parts/{make}/`, `/{locale}/parts/{make}/{series}/` and `/{locale}/parts/{make}/{series}/{category}/`, beside the part pages and the Category pages, in all three locales. The Model page (`/parts/{make}/{model}/`), its Category pages and the Vehicle pages (`/parts/{make}/{model}/m/{vehicle}/`) are gone.
- **A Model (a modification, «1.0 (6C)») and a Vehicle are not URLs of their own.** The Series page lists its Models, each with its engines, power and years, as links into the existing server-rendered search scoped to that Model (`/parts/search/?make=…&model=…`), which is `noindex`. That search now lists every Part fitting the Model without a query or a Category. A resolved VIN lands there too, carrying `vin` and `steering`, and the search remembers the car in My garage; an unresolved VIN whose candidates share a Series lands on the Series page.
- **A Series has a page by the rule a Model had:** three distinct published Parts across its Vehicles, or two Requirement matches in one Category (`seriesHasPage`). A Make has a page while one of its Series has one.
- **A Series x Category has a page only from three Parts** (`seriesCategoryHasPage`, `MIN_PARTS_FOR_PAGE`), counting the Parts fitted to the Series and those its Requirements match. Below that the Category is simply not a hub of that Series; its Parts stay on the Series page's popular block, the part pages and the Category page.
- **The Series slug is derived from its name**, since `series` has no slug column: `seriesSlugOf` in `@podbor/catalog-contract/slug`, shared by the storefront and the shop's car index. A name made only of Latin letters, digits and the separators the unique Series name key folds (space, `.`, `_`, `-`) gets the plain slug (`Polo V` is `polo-v`), and such slugs are unique within a Make because the name key is. Any other name gets the slug plus a six-character hash of the name (`C+` is `c-…`, a Cyrillic name is the hash alone), so two Series of one Make never share a slug, without either side needing the full list. No shop migration.
- **The shop's car index follows the pages.** Car search hits are Makes and Series with a page (`kind: 'series'`, a new nullable `series` on the hit); a Series hit carries the names, chassis codes and engine codes of its cars, so «polo 1.0 tdi» still finds it. `scope_pages` reports `{ make, series }`. Part search documents carry the Series key beside the Make, Model and Vehicle keys.
- **No redirect for an old Model or Vehicle URL.** Nothing is indexed yet and Vercel's 2,048-route limit (ADR-0049) rules out one route per old address; they 404. A recorded Model or Vehicle slug redirect writes no route any more; a Category rename writes one route per Series and locale.
- **ADR-0061 refined:** the parts level under a Make is the Series. A future link from a Work or an Article to the catalogue goes to a Series page, not a Model page; `/parts/<make>/` and its link with `/cars/<make>/` are unchanged.

**Why:** with only 1,685 Parts the Model and Vehicle levels gave about 14,400 Model pages, 16,300 Model x Category pages and 21,500 Vehicle pages per locale, three locales over. Most were near-duplicates of one another (the same Parts under each engine of a Series), thin, and a heavy crawl budget for a new domain that search engines do not trust yet. The build time and page count also stand in the way of the owner's plan to move hosting to his own server behind BunnyCDN. A Series is the level people search by («Polo V parts»), and the modification choice is better served by a filtered search than by tens of thousands of static pages.

## Considered Options

- **Keep Model pages and drop only Vehicle pages.** Rejected: Models alone are still about 30,000 pages per locale with Categories, mostly duplicates within a Series.
- **A slug column on `series`.** Rejected for now: an additive migration and a backfill for a value the name already gives. If staff start renaming Series after launch, a frozen slug column with redirects (ADR-0049) is the next step.
- **Resolve slug collisions by sorting each Make's Series and numbering them.** Rejected: both sides would need the same full list of Series, and a new Series could renumber an existing one.
- **Filters and the popular order on a Series x Category page.** Left out: the search has no Series scope, so they would open the whole Category. A Series scope in the search is the follow-up if the pages need filters.

## Consequences

- A Series rename moves its URL without a redirect, unlike the slugs ADR-0049 freezes.
- The vehicle page features (the maintenance kit, Requirement matches per car, the steering filter on fitments) have no static page any more; the part pages still name the cars a Part's Requirements and kits fit, linking to their Series.
- A Series name that is not plain Latin (the demo seeds Russian names) gets a hashed slug. Production Series come from suppliers in Latin.
- The `partsCar.hubs.model` copy now serves the Series page; its `singleCar*` strings and the vehicle page copy are unused until cleaned up together with their translations.
