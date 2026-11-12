---
status: accepted
---

# Make pages gather Works, Articles and Parts by the catalogue's Make slug

Decided 2026-11-06 with the owner, who wants a page per car make that people find by searching for the service («BMW in Belgrade»), fed by the Works the partner writes, by Articles and by the parts catalogue. Refines [ADR-0049](0049-catalogue-urls-are-frozen-and-redirect.md).

**Decision:**

- **The Make page lives at `/cars/<make>/`** and the slug is the catalogue Make's own, frozen under ADR-0049 (`bmw`, `volkswagen`, `mercedes-benz`). `/bmw/`, the one hand-made make page today, redirects to `/cars/bmw/`. `/parts/<make>/` stays as the Parts make hub, the entry to part search and an address that must live; the two pages link to each other.
- **The catalogue is the only place a Make or Model is created.** Works and Articles do not hold vehicles: each names one Make, chosen from a dropdown with search whose list is exported from the catalogue (slug and name, one file regenerated from it), and nothing is matched from the free-text car name. A Model is never matched from the name: catalogue Models are named by the manufacturer's codes («118i» under chassis F20, «2.0 TDI 16V» under an Audi Q5), which a car described as «BMW 118d» does not match. Linking a Work or an Article to a Model, and showing it on `/parts/<make>/<model>/`, waits until the catalogue is live and the Models people ask about are known.
- **A Make has a page when any source has material:** a Work, an Article, or at least one published Part. No empty pages, and only a Make the catalogue knows can have one. A Make page shows the Parts block only once the catalogue has Parts for the Make, so a build without a catalogue snapshot still produces the pages from Works and Articles.
- **A Make page is a workshop page.** It is written and ordered for the search «repair BMW in Belgrade»: heading and title about service on that make, in this order: the call and the booking, what CarLab does on that make, the Parts block when the catalogue has Parts for it, the Works, the frequent questions, and the Articles last, since they matter least for the visit. The Parts block is a short way into the catalogue (top Categories and the link to the Parts make hub), which keeps the full parts search.
- **`/cars/` lists the Makes that have a page,** with a picture each, pagination and a search over them. The menu entry is «Машины», in the footer first and not in the header; the pages themselves are about Makes.
- **There is no service page per Model.** A Make page and the existing Parts make hub and Model page are the only levels.
- **Keystatic holds Works and Articles and no Makes.** There is no collection of Makes: the text about a Make is an Article marked as that Make's overview, with a picture, a heading, a lead, a body and frequent questions, and it heads the Make page; ordinary Articles follow it. The picture of a Make's card on `/cars/` is the overview's picture, or else the cover of its latest Work. Articles are the blog: each one has its own page at `/blog/<slug>/`, listed on `/blog/` with a picture and pagination, outside `/cars/` as Works are outside it at `/works/<slug>/`. An Article may name no Make; one that names a Make is listed on that Make's page and links back to it. An overview Article is shown only on its Make page and has no blog page of its own, so the same text is not published twice. Both collections are Russian only and translated by the existing `translate` job, so the partner adds an Article without a developer. Articles carry no tags yet.

**Why:** Makes, Series, Chassis, Models and Vehicles already exist once, in the shop, 49 Makes and thousands of Vehicles fed by the crawler and staff. Holding them again in the Works or in a third list would make the same car in three places. The slug is the join: it is frozen, so it is the one key every source can share.

## Considered Options

- **Keystatic owns the vehicles and the shop reads them.** Rejected: the catalogue already holds them and keeps growing from the crawler, so it would be rebuilt around the site.
- **A separate list of Makes and Models for the pages.** Rejected: a third copy.
- **A Keystatic collection of Makes holding each Make's text, keyed by the catalogue slug.** Rejected: a second list of Makes tied to the first by a string, with orphans and the question of where a new Make is created.
- **The text about a Make in the shop's Make fields.** Rejected for now: one place for the Make and its text, but the partner would write it in the shop admin and a running server is needed first.
- **`/services/<make>/`.** Rejected: it shares one dynamic route with the service slugs, and a Make is not a service.
- **Articles under `/cars/<make>/<article>/`.** Rejected: an Article can be about no Make or change its Make, and a URL tied to the Make would move; Works already sit outside the Make for the same reason.
- **Merge into `/parts/<make>/`.** Rejected: that page answers a parts search, the Make page answers a search for the workshop, and one page would serve neither well.

## Consequences

- The exported list of Makes is a derived file, not a second place Makes are created. Until the first Publish it is exported from the catalogue the crawler filled; once a snapshot exists the build compares the file with it and says when a slug is missing or differs.
- The Works already written get their Make chosen once, and the `/works/` chips group by that choice, so a Work's Make is decided in one way.
- A Make with one Work or one published Part gets a page and is indexed, since the owner chose a threshold of 1. If Search Console shows thin pages being dropped, a `noindex` rule for them is the next step.
- The pages can be built before the shop is live, on Works and Articles alone.
- A Make the catalogue does not know (Tesla, Lynk & Co) is not in the dropdown and has no page until it is created in the catalogue; a Work or Article that names no Make stays in its own list.
- The blog is a mechanic, so its logic (the Article schema, listing and pagination) goes into a package with its tests, while the markup stays per site. Only carlab.rs gets the blog now; approved.rs and details.rs adopt it later without rework. The Make pages and `/cars/` belong to the parts catalogue and stay carlab.rs only.
- `/blog/` is a new section: its index, the Article pages, a footer entry and `llms.txt` and sitemap lines come with this work.
- The Parts make hub and the Make page both appear in `llms.txt` and the sitemap.
