---
status: accepted
---

# Catalogue URLs are frozen at creation and redirect when they move

Decided 2026-10-28 with the owner, before the first crawled data reaches production. Refines the Vehicle side of [ADR-0047](0047-crawled-applicability-becomes-fitments.md).

**Decision:** every catalogue slug on carlab.rs (Brand, Make, Model, Vehicle, Category) is computed once when its row is created and then never recomputed from data, and a slug once used is never given to another row. Staff may still rename a slug, and a rename, a merge of duplicates or a deletion records a redirect, which carlab.rs serves as a 301 (a deleted part leads to its Category). Crawled names are cleaned before they become slugs: a Make has one canonical name with each source's spelling as an alias (`volkswagen`, not `volkswagen-vw`), and a Model's slug is series, chassis and model within its Make (`3-series-e90-320d`), with no repeated make, dates or arrows. Vehicle pages are indexable at `/parts/<make>/<model>/m/<engine>-<kw>kw/`; when a Model has a single Vehicle, the Vehicle page points its canonical at the Model page and stays out of the sitemap. The old `/parts/car/<id>/` addresses redirect there.

**Why:** these pages exist to be found in search, and their slugs used to follow crawled strings and import order. A re-import, a merge of two spellings of one Make or the deletion of an orphan could move an indexed URL, or hand a freed `-2` slug to a different car, which is worse than a 404.

## Considered Options

- **Forbid slug edits in the admin.** Rejected: simpler, but deletions and merges still break indexed URLs, so redirects are needed regardless.
- **Vehicle pages directly under the Model (`/parts/<make>/<model>/<engine>/`).** Rejected: that segment is already the Category page of a Model, so the two would collide; hence the `m/` segment.
