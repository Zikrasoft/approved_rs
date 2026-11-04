# carlab.rs renders only the catalogue pages whose data changed

carlab.rs builds a page for every Part, Model, Vehicle, Model x Category, Category listing and Make, in five locales, and a Publish after a small catalogue change rebuilt all of them. carlab.rs now turns on Astro's `experimental.incrementalBuild` (Astro 7.2): each of those routes returns a `cacheKey` from `getStaticPaths`, and a page whose key and module graph both match the previous build is copied from the cache instead of rendered. Every other page has no key and renders on every build, as before.

## How a stale page is avoided

A cached page is reused only when nothing it renders has moved. Astro already throws the whole cache away on a config or lockfile change, and drops a route's pages when any module it imports changes. That covers the code, the i18n YAML (imported through `import.meta.glob` with `?raw`) and the environment the pages read, since Astro inlines `import.meta.env` values into the bundled modules at build time, so flipping `SHOP_OPEN` changes the module hash.

What Astro cannot see is data, and `cacheKey` (`src/utils/cacheKey.ts`) is the digest of exactly that, built in each route's `getStaticPaths`:

- the page's own entry from the catalogue snapshot (a Make hub, a Model hub, a Model x Category entry with its Make and Model, a Vehicle page, a Category with its listing);
- for a link to another catalogue page, whether that page exists (`linkedVehicles`, and the Model links on a Part page), not the whole set of pages, so adding one Vehicle does not invalidate every Part;
- on a Part page, also its successor, its current numbers, the entries of the equivalents it shows and the Works that sourced it (#439), because those come from outside the page's own entry; a Work is read through `getCollection`, which the cache does not track;
- the current year, which the footer prints.

A key covers more than the page shows rather than less: a Category listing digests its whole Category because the facets and fields read every Part in it. Over-including costs a re-render; under-including serves stale markup. So a new prop or a new data source on one of these pages goes into its `cacheKey` in the same change, and `cacheKey.test.ts` holds the rule: the same data gives the same key, changed rendered data a new one.

`build.concurrency` stays at its default of 1, because Astro turns the cache off above 1.

## Where the cache lives

`vercel build` runs on a fresh GitHub runner, so an empty `node_modules/.astro` would render everything. The carlab.rs build in `ci.yml` and the Publish workflow restore and save that directory with `actions/cache`, keyed `astro-carlab-<branch>-<run>` and restored from the newest `astro-carlab-<branch>-` entry, so each run starts from the last successful build on its branch. A failed build saves nothing. If a cache is ever suspected, deleting the `astro-carlab-*` entries (`gh cache delete`) makes the next build a full one.

## approved.rs and details.rs stay full builds

Their `vercel build` step took a median of about 25 s (approved.rs, 15 to 29 s) and 13 s (details.rs, 9 to 15 s) over the CI runs on main from late September to October 2026. Restoring a cache costs seconds of that, and every dynamic route would need its own `cacheKey`, so neither pays for the plumbing. Measure again if either grows a data-driven section.
