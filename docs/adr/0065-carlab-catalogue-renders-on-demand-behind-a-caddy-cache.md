# carlab.rs renders the catalogue on demand behind a Caddy cache

carlab.rs prerendered every catalogue page from one shop snapshot. After the bilstein Import (14,482 new Parts) the snapshot reached 658 MB, its download outgrew the build's fetch timeout, and every Publish rebuilt the whole site for over an hour. So every catalogue route (`/parts/**` and `/cars/**`: makes, Make hubs, series hubs, series x Category, Category listings, Part pages) is now `prerender = false`, and Caddy caches the rendered HTML on the VPS disk through the `cache-handler` module, for 24 hours with `stale-while-revalidate`. The rest of the site stays prerendered, and the catalogue snapshot endpoint goes away.

**Data comes from the shop, ready to render.** Each page type has its own store endpoint that computes the page with SQL and answers in a `@podbor/catalog-contract` schema, under the page rules already shared in `placePages.ts`. The site calls it over the internal network (`SHOP_INTERNAL_URL`) and computes no catalogue structure itself: the site container has 160 MB.

**Publish keeps its meaning, at a fraction of the cost.** The shop step runs as before and freezes which numbers are published, then the site rebuilds. That build reads only a light list of URLs from the shop for the sitemap, `llms.txt` and the shrink guard, which now counts Part pages from that list. `deploy-site.sh` purges the site's Caddy cache after it switches the release, so a Publish and a code release both reach visitors at once. A new Part still appears only after a Publish; an edit to a published Part reaches the site when its cached page expires, within a day.

**Failure and privacy.** When the shop is down, Caddy serves a stale copy if it has one, otherwise the page answers 503 with `Retry-After`, never 404, so search engines keep the URL. An unknown slug on a live shop is a 404. A request carrying the shop preview cookie bypasses the cache and renders with prices, answered `private, no-store`; the cached copy never carries prices. The cache is not warmed after a purge: a single page is one cheap shop query, and warming waits until Grafana shows Medusa struggling under a crawl.

## Consequences

The cache is Souin's `simplefs` (v0.0.20, the last that builds against Caddy 2.11.4), in a Caddy image CI builds and pushes to GHCR beside the shop image, under a 256 MB limit. Two of its limits are accepted rather than worked around with another storage:

- **No stale copy after a day.** `simplefs` drops a page when its `s-maxage` runs out, so `stale-while-revalidate` and `stale-if-error` never apply. While the shop is down, a page cached within the last 24 hours is a hit; any other page is a 503.
- **A restart empties it.** The index lives in Caddy's memory, so every Caddy restart, every reload with a changed Caddyfile and every shop deploy starts the cache cold.

Measured since: each page the size cap evicts leaks memory, and a crawl of more pages than the cap holds ends with the kernel killing Caddy, which restarts with an empty cache (`docs/guides/deploy.md`, carlab.rs catalogue page cache).

## Considered options

- **Prerender the popular series, render the rest on demand.** Astro prerenders or server-renders a whole route, not part of its paths, so this meant either two routes per page type or a post-build crawl that writes HTML into the release. Both keep a second path to the same page for a cold start the cache already covers.
- **BunnyCDN in front of the site.** Faster for visitors, but a DNS move and an outside service for a site with one VPS. Still possible later in front of the Caddy cache.
- **An in-process LRU in the site.** No infrastructure, but 160 MB of memory and an empty cache on every restart.
- **The site reads Postgres directly.** Faster, but the site would know the shop's schema and bypass the contract that lets the two deploy separately.

Supersedes [ADR-0055](0055-carlab-renders-only-changed-catalogue-pages.md) for the catalogue routes.
