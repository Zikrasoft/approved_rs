# A polite catalogue crawler, and what free parts data exists

Research date: **2026-10-25**. Two questions for issue #399 (catalogue
adapters for the four sites the owner approved in #396: MANN-FILTER, FILTRON,
bilstein group partsfinder, VARTA). The owner's decisions on that issue fix the
shape: a separate `crawler` container in `infra/auto-service-shop` compose, raw pages
stored in Postgres, resumable after a failure, started by a button in the shop
admin that shows progress, images kept as their original URL, and each site's
Supplier adapter ([ADR-0043](../adr/0043-supplier-adapters-catalogue-import-page-per-brand-number.md))
parsing the stored snapshot.

1. How does such a crawler stay polite and robust enough that the site
   operators do not block it, and which Node/TypeScript libraries fit?
2. Which free or freemium APIs and datasets give part numbers, cross
   references, vehicle applicability, specs or EU VIN decoding?

Out of scope on purpose: bypassing Cloudflare or other bot protection,
fingerprint spoofing, proxy rotation. If a site blocks us, the answer below is
to stop and ask.

Earlier notes this builds on and does not repeat:
[catalogue-auto-fill.md](./catalogue-auto-fill.md) (legal frame, brand data,
open data), [fitment-data-sourcing.md](./fitment-data-sourcing.md) (TecDoc,
OEM catalogues, Inter Cars, ACES/PIES),
[tecdoc-licence-pricing.md](./tecdoc-licence-pricing.md) (TecDoc terms and
prices, grey sources), [intercars-ecat-api.md](./intercars-ecat-api.md),
[vin-decode-options.md](./vin-decode-options.md) and
[vin-decode-cheap-alternatives.md](./vin-decode-cheap-alternatives.md) (vPIC,
paid EU decoders, the bimmerarchive type-key mirror). The per-site findings
(robots, terms, page counts, risk) are in the #396 comment and are not
repeated either.

Not legal advice. The database-right risk of crawling these sites was accepted
by the owner in #391.

## Source status

Same tags as the rest of `docs/research/`:

- **[P]** primary: an RFC, a standard, a library's own docs or repository, a
  data publisher's own page or API, or a live request made in this session.
- **[S]** secondary: a search-engine snippet of a page that would not render.
- **[NOT ESTABLISHED]** could not be verified.

## The one-paragraph answer

Politeness is mostly a handful of rules that are easy to state and easy to
break by using a scraping framework's defaults. Obey robots.txt as RFC 9309
says (cache it at most 24 hours, treat a 5xx on it as "disallow everything"),
treat `Crawl-delay` as a floor even though the RFC does not define it, fetch
one page at a time per host, honour `Retry-After` on 429 and 503 and slow down
on errors the way Google does, identify ourselves with a named User-Agent and a
`From` address, seed the crawl from sitemaps, and stop on a 403 or a challenge
page instead of retrying. Crawlee, the obvious Node framework, fits badly here:
its default HTTP client generates browser fingerprints, its queue persists to
the local filesystem rather than Postgres, and its docs do not say it honours
`Crawl-delay`. A small crawler on Node's built-in `fetch` (undici),
`robots-parser`, an XML parser for sitemaps and a Postgres frontier claimed with
`FOR UPDATE SKIP LOCKED` is less code to reason about and does exactly what the
owner decided. On data: **no free source gives parts, cross references or
applicability for EU cars**; that conclusion from the earlier notes stands.
What the free sources do give is vehicle identity: the Dutch RDW register
(CC0, per plate, with EU type-approval type, variant and version), the EEA CO2
monitoring dataset (CC BY 4.0, every new EU car's type-approval variant and
version, power and engine capacity) and Finland's Traficom register
(CC BY 4.0). These can cross-check our own Vehicle table, not fill Fitments.

## 1. Politeness rules

### 1.1 robots.txt (RFC 9309)

- A crawler matches its group by product token, case-insensitively; several
  matching groups are combined; with no match it uses the `*` group (§2.2.1)
  [P] ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)).
- The longest matching rule wins; on a tie, `allow` wins (§2.2.2) [P].
- A 4xx on robots.txt means the crawler "MAY access any resources"
  (§2.3.1.3); a 5xx or network failure means it "MUST assume complete
  disallow" (§2.3.1.4) [P]. Google treats 429 on robots.txt unlike other 4xx
  and, on 5xx, stops crawling for 12 hours while retrying [P]
  ([Google robots.txt spec](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt)).
- Follow at least five redirects (§2.3.1.2); do not use a cached copy for
  more than 24 hours unless the file is unreachable (§2.4); parse at least
  500 KiB (§2.5) [P]. A crawl that runs for days (bilstein, about 9.5 days)
  therefore re-fetches robots.txt at least daily during the run.

### 1.2 Crawl-delay

- `Crawl-delay` is **not** part of RFC 9309; §2.2.4 allows a crawler to
  interpret other records as long as they do not interfere with the defined
  ones [P] ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)).
- Google ignores it [P]
  ([Google robots.txt spec](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt)).
  Bing reads it as a time window in which it fetches at most one page: 5
  seconds means at most one request per 5 s [P]
  ([Bing webmaster blog](https://blogs.bing.com/webmaster/2012/05/03/to-crawl-or-not-to-crawl-that-is-bingbots-question)).
- For us the Bing reading is the polite one: the site owner wrote a number, so
  it is the minimum gap between our requests to that host. bilstein's
  robots.txt still carries `Crawl-delay: 5` for `User-agent: *` [P, fetched
  in this session].

### 1.3 Rate limiting and backoff

- 429 means "too many requests in a given amount of time" and "MAY include a
  Retry-After header" [P] ([RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4)).
  503 is "a temporary overload or scheduled maintenance" [P]
  ([RFC 9110 §15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable)).
  `Retry-After` is either an HTTP-date or a number of seconds [P]
  ([RFC 9110 §10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after)).
- On 500, 503 and 429, Google "reduces your site's crawl rate across the whole
  hostname", including the URLs that still return content, and raises it again
  as errors fall [P]
  ([Google, reduce crawl rate](https://developers.google.com/search/docs/crawling-indexing/reduce-crawl-rate)).
  That is the model: an error slows the whole host, not just the one URL.
- undici's `RetryHandler` (behind `RetryAgent` and `interceptors.retry`)
  retries 500/502/503/504/429 by default, 5 times, exponential from 500 ms to a
  30 s cap, and lets `Retry-After` take precedence, "still capped at
  `maxTimeout`" [P]
  ([undici RetryHandler](https://github.com/nodejs/undici/blob/main/docs/docs/api/RetryHandler.md)).
  The cap matters: a `Retry-After: 3600` would be cut to 30 s. For a crawler,
  a retry belongs in the frontier (`next_attempt_at`), not in a socket-level
  retry loop that hides the wait from the admin's progress view.

### 1.4 Conditional requests

- `If-None-Match` (with the stored `ETag`) and `If-Modified-Since` (with the
  stored `Last-Modified`) let the server answer 304, meaning the cached copy
  can be reused [P]
  ([RFC 9110 §13.1.2, §13.1.3, §15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-none-match)).
  Google's crawlers support both and recommend `ETag` [P]
  ([Google crawlers overview](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)).
- **On our sites, do not count on it.** In this session a MANN product page
  returned an `ETag` and `Last-Modified`, and a bilstein article page an
  `ETag` with `Cache-Control: no-store`; sending them back returned **200, not
  304**, on both sites (one request per header) [P]. Sending the headers costs
  nothing, so send them, but plan recrawls as full fetches.
- Sitemap `<lastmod>` is meant to be the date the page last changed, "not when
  the sitemap is generated" [P]
  ([sitemaps.org](https://www.sitemaps.org/protocol.html)). The first MANN
  entries carried 2026-10-23 and 2026-10-25, fetched on 2026-10-25 [P], which
  suggests the dates track regeneration rather than content [inference]. Using
  `lastmod` to skip unchanged pages needs a check against two snapshots first.

### 1.5 Identifying ourselves

- "A robotic user agent SHOULD send a valid From header field so that the
  origin server can contact the robot's operator" [P]
  ([RFC 9110 §10.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#name-from)).
  The User-Agent should not carry overly detailed version data (§10.1.5) [P].
- The usual pattern is a product token plus an info URL; the product token is also what a site's robots.txt can name to
  slow or block us specifically, which only works if the token is stable.
- #396 recorded that VARTA served a maintenance page instead of its sitemap to
  a plain curl User-Agent. In this session the same sitemap index came back as
  XML to `CarLabCatalogBot/0.1 (+https://carlab.rs/)` [P]. So an honest,
  named User-Agent works there today; a browser User-Agent is not needed and
  should not be used.

### 1.6 Sitemap-driven crawling

- One sitemap holds at most 50,000 URLs and 50 MB uncompressed; a sitemap
  index lists up to 50,000 sitemaps on the same site; gzip is allowed;
  `Sitemap:` lines in robots.txt are independent of user-agent groups [P]
  ([sitemaps.org](https://www.sitemaps.org/protocol.html)).
- All four sites publish sitemaps from robots.txt: MANN per-locale
  `*.sitemap-commerce.xml`, bilstein per-locale gzipped sitemap indexes, VARTA
  `/sitemap/sitemap-index.xml` (its robots.txt disallows `/sitemap.xml`, the
  old path) [P, fetched in this session]. A sitemap seed means no link
  following, no category paging and no search pages, so the crawler never
  touches the disallowed `/search`, `/api/` or `/vue/` paths at all.

### 1.7 Resumability: the frontier in Postgres

- With `SKIP LOCKED`, rows that cannot be locked immediately are skipped,
  which "can be used to avoid lock contention with multiple consumers
  accessing a queue-like table" [P]
  ([PostgreSQL SELECT, locking clause](https://www.postgresql.org/docs/current/sql-select.html)).
- A frontier row per (site, URL) with a status, attempt count,
  `next_attempt_at`, the last `ETag`/`Last-Modified` and HTTP status makes
  resume trivial: a restarted container claims the next due row. A unique key
  on (site, URL) makes re-seeding from the sitemap idempotent. A run row per
  site gives the admin its progress (done, pending, failed, paused reason)
  with a `count(*)`.
- `pg-boss` (MIT, 12.38.0) is a ready-made Postgres job queue [P,
  npm registry]. One job per URL would put tens of thousands of jobs in it per
  run; a plain frontier table is simpler and the frontier is what the admin
  wants to display anyway.

### 1.8 Storing raw pages

- Postgres stores large values out of line through TOAST, compressed with
  `pglz` or `lz4` (chosen per column or by `default_toast_compression`), up
  to 1 GB per field; the docs' example stored typical HTML at about 50% of its
  raw size [P]
  ([PostgreSQL TOAST](https://www.postgresql.org/docs/current/storage-toast.html)).
  The shop runs `postgres:16.15-alpine` [P,
  `infra/auto-service-shop/docker-compose.yml`], so `lz4` is available.
- Sizes matter on one VPS. One MANN product page was **658 KB** of HTML and a
  bilstein article page **24 KB** [P, `Content-Length` in this session]. At
  13,132 MANN pages that is about 8.6 GB raw per locale; 163,709 bilstein
  pages about 3.9 GB [arithmetic]. Compressing in the app (`node:zlib`
  gzip or brotli) before writing a `bytea` is likely to do better than
  `pglz` on repetitive HTML [NOT ESTABLISHED, measure on a sample]. Keep only
  the latest snapshot per URL plus its fetch metadata; the adapter only ever
  parses the latest one.

### 1.9 Headless browser only when needed

- Crawlee itself describes its plain-HTTP Cheerio crawler as "very fast and
  efficient, but can't handle JavaScript rendering" [P]
  ([Crawlee quick start](https://crawlee.dev/js/docs/quick-start)).
- #396 found every field we want server-rendered on MANN, FILTRON and VARTA,
  and on bilstein everything except vehicle applicability, which a Vue
  component loads from paths robots.txt disallows (`/api/`, `/vue/`,
  `/service-vue/`, `/pfb/`). A headless browser would make exactly those
  disallowed requests on our behalf, so it does not make that data allowed.
  **No site in #399 needs a browser.**

### 1.10 When a site pushes back

- A 403, a challenge page ("Just a moment..."), a login redirect or a sudden
  switch to a maintenance page is a "no", not a transient error. The polite
  response is to pause that site's run, show the reason in the admin, and
  ask the operator, not to retry with different headers.
- A robots.txt change that newly disallows our paths, or names our token,
  stops the run at its next daily re-read (§1.1).

## 2. Libraries

| Library                                                                                                  | What it is                                                                   | Fit for this crawler                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Crawlee](https://crawlee.dev/js/api/basic-crawler/interface/BasicCrawlerOptions) 3.18.2, Apache-2.0 [P] | Full framework: queue, retries, autoscaling, Cheerio and Playwright crawlers | `maxRequestsPerMinute`, `sameDomainDelaySecs` and `respectRobotsTxtFile` exist; the docs do not mention `Crawl-delay` for either the option or `RobotsTxtFile` [P]. Its queue is "stored in memory, while also being off-loaded to the local directory" [P] ([request storage](https://crawlee.dev/js/docs/guides/request-storage)), not Postgres. `retryOnBlocked` "will automatically try to bypass any detected bot protection" [P], which is the opposite of our policy. Poor fit. |
| [got-scraping](https://github.com/apify/got-scraping) 4.2.2 [P]                                          | Crawlee's HTTP client                                                        | Generates browser-like headers and fingerprints by default (`useHeaderGenerator: true`); the repository says the package is deprecated in favour of `impit` [P]. Do not use.                                                                                                                                                                                                                                                                                                           |
| `impit` 0.14.7, Apache-2.0 [P, npm]                                                                      | Apify's successor client                                                     | Browser impersonation is its purpose [NOT ESTABLISHED in detail; not read further on purpose]. Out of scope.                                                                                                                                                                                                                                                                                                                                                                           |
| [robots-parser](https://github.com/samclarke/robots-parser) 3.0.1, MIT [P]                               | Parses a robots.txt string                                                   | `isAllowed`, `getCrawlDelay`, `getSitemaps`; wildcards and `$`; targets RFC 9309 and Google's matcher; does not fetch [P]. Last release 2023 [P, npm], but the format is stable. Crawlee depends on it too [P, npm]. Good fit.                                                                                                                                                                                                                                                         |
| Node built-in `fetch` (undici); [undici](https://github.com/nodejs/undici) 8.12.3, MIT [P]               | HTTP client                                                                  | No extra dependency for `fetch`. undici adds `RetryAgent` (see §1.3 for the 30 s cap) and a cache interceptor with memory and SQLite stores that revalidates with ETag [P] ([CacheStore](https://github.com/nodejs/undici/blob/main/docs/docs/api/CacheStore.md)); neither is needed when the frontier holds the validators. Good fit.                                                                                                                                                 |
| `fast-xml-parser` 5.11.2 MIT, or `sax` 1.6.1 [P, npm]                                                    | XML parsing                                                                  | For sitemaps; `node:zlib` gunzips `.xml.gz`. Largest sitemap is 50,000 URLs, so a whole-document parser is fine. Crawlee's `Sitemap` class handles indexes and `.gz` [P] ([Sitemap](https://crawlee.dev/js/api/utils/class/Sitemap)) but pulls in the framework.                                                                                                                                                                                                                       |
| `cheerio` 1.2.0, MIT [P, npm]                                                                            | jQuery-like HTML parsing                                                     | Belongs in the adapters that parse snapshots (and their fixture tests), not in the crawler, which only stores bytes.                                                                                                                                                                                                                                                                                                                                                                   |
| `playwright` 1.64.1, Apache-2.0 [P, npm]                                                                 | Headless browser                                                             | Not needed (§1.9).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Trade-off for a long-running service.** A framework earns its weight when
the crawl follows links across many hosts with high concurrency. Ours is the
opposite: four known hosts, one request at a time each, URLs known up front
from sitemaps, progress shown from a table. The rules in §1 are a few dozen
lines on `fetch`; Crawlee's defaults would have to be switched off one by one
(header generation, bot-protection retries, filesystem storage) and its
`Crawl-delay` handling is undocumented.

## 3. The four approved sites, checked in this session

All requests were made with `CarLabCatalogBot/0.1 (+https://carlab.rs/)`, a
few seconds apart [P].

| Site                 | robots.txt for `*`                                                      | Pace                | Validators on product page                                        | Pages (from #396)                   | Full pass |
| -------------------- | ----------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------- | ----------------------------------- | --------- |
| MANN-FILTER          | Only `/api/graphql/` disallowed; no `Crawl-delay`                       | Owner's 1 req / 2 s | `ETag`, `Last-Modified`, `max-age=600`; conditional GET still 200 | 13,132 (`en`)                       | ~7.3 h    |
| FILTRON              | Only `/api/graphql/`; behind Cloudflare (`server: cloudflare`)          | 1 req / 2 s         | Not checked (guessed URL 404'd)                                   | 4,267 per locale, `sr` exists       | ~2.4 h    |
| bilstein partsfinder | `Crawl-delay: 5`; `/api/`, `/vue/`, `/service-vue/`, `/pfb/` disallowed | 1 req / 5 s         | `ETag`, `no-store`; conditional GET still 200                     | 163,709 (`sr`)                      | ~9.5 days |
| VARTA                | `/search`, dev pages, `/sitemap.xml` disallowed                         | 1 req / 2 s         | Not checked                                                       | 360 per locale, `sr-latn-rs` exists | minutes   |

FILTRON sitting behind Cloudflare means a too-fast or odd-looking client may
get a challenge; that is the §1.10 case, not something to work around.

## 4. Free and freemium data

| Source                                   | What it actually offers                                                                                                                                                                                                                                                                                                                                                              | Licence and cost                                                                                                                                                                                                                                                                                               | EU / Serbia coverage                                                    | Use for us                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RDW open data** (Netherlands)          | Per registered vehicle by plate: make, trade name, EU type-approval number, type, **variant**, **version** (`uitvoering`), cc, cylinders, masses, dimensions; a linked fuel table with net power and Euro class [P, live record below]                                                                                                                                               | **CC0**, free, fair use, no availability guarantee; reusers may **not** state that the data comes from RDW or use its logo [P] ([bijsluiter](https://www.rdw.nl/over-rdw/dienstverlening/open-data/bijsluiter), [dataset](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2)) | Dutch fleet only, but the same EU type approvals as cars sold in Serbia | Cross-check Vehicle rows: a 2020 BMW 320D record carried type `G3K`, variant `6L51`, version `DAW500T0`, 1995 cc, 140 kW [P]. That `variant` equals the BMW type key (VIN characters 4 to 7) has the right shape but is **NOT ESTABLISHED**; test against a real VIN. No VIN, no engine code, no parts. |
| **EEA CO2 monitoring, passenger cars**   | Every newly registered car: manufacturer, type-approval number, type, variant, version, make, commercial name, masses, wheelbase, track, engine capacity and power, fuel [P]                                                                                                                                                                                                         | **CC BY 4.0**, free; csv/txt/sql downloads and an SQL endpoint [P] ([2024 final record](https://sdi.eea.europa.eu/catalogue/datahub/api/records/5018ec17-2348-4c92-8761-6f2377bbd1c0?language=eng))                                                                                                            | EU-27, Iceland since 2018, Norway since 2019; **not Serbia** [P]        | Same role as RDW at EU scale, by model year. No engine code, no parts.                                                                                                                                                                                                                                  |
| **Traficom vehicle open data** (Finland) | Registration, approval and technical data for all vehicles in traffic, quarterly CSV (~5.2 M rows) [P for licence and description, S for size]                                                                                                                                                                                                                                       | **CC BY 4.0** [P] ([CKAN API record](https://avoindata.suomi.fi/data/api/3/action/package_show?id=ajoneuvojen-avoin-data))                                                                                                                                                                                     | Finnish fleet                                                           | Field list is an xlsx not read; whether it has type-approval variant or engine code is **NOT ESTABLISHED**.                                                                                                                                                                                             |
| **Statens vegvesen API** (Norway)        | Technical data by plate or VIN: dimensions, weight, engine and performance, brakes, axles, tyre/rim combos [P] ([vegvesen](https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/api-for-tekniske-kjoretoyopplysninger/))                                                                                                                                              | Free key, but requires a Norwegian eID and an Altinn role [P]; 50,000 calls/day [S]                                                                                                                                                                                                                            | Norwegian fleet                                                         | Not reachable for a Serbian company without Norwegian eID [inference].                                                                                                                                                                                                                                  |
| **DVLA Vehicle Enquiry Service** (UK)    | Make, colour, fuel, cc, CO2, tax and MOT status, year, Euro standard by plate; no VIN, no engine code [P]                                                                                                                                                                                                                                                                            | New registrations **closed** at the time of reading [P] ([DVLA VES](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html))                                                                                                       | UK, right-hand drive                                                    | Not useful.                                                                                                                                                                                                                                                                                             |
| **NHTSA vPIC**                           | Covered in [vin-decode-options.md](./vin-decode-options.md#1-freepublic-decoders-nhtsa-vpic): WMI and plant only for EU VINs. A standalone database download exists and automated traffic is rate controlled [P] ([vPIC API](https://vpic.nhtsa.dot.gov/api/))                                                                                                                       | Free; reuse terms on the page **NOT ESTABLISHED**                                                                                                                                                                                                                                                              | US-market data                                                          | No.                                                                                                                                                                                                                                                                                                     |
| **Wikidata**                             | Structured data under **CC0** [P] ([licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)). The `BMW B47` item (Q15727729) has bore, stroke, cylinders, compression ratio, fuel system, power; no car item links to it through "powered by" (P516) [P, SPARQL in this session]                                                                                                | CC0, free                                                                                                                                                                                                                                                                                                      | Global, thin                                                            | Engine-family facts only; no parts, no applicability.                                                                                                                                                                                                                                                   |
| **Serbia**                               | `stat.gov.rs` publishes registered-vehicle statistics [S]; a data.gov.rs API search for "vozila" returned nothing [P]                                                                                                                                                                                                                                                                | n/a                                                                                                                                                                                                                                                                                                            | Serbia                                                                  | **No open per-vehicle register found.**                                                                                                                                                                                                                                                                 |
| VehiclesDB, bimmerarchive mirror         | Covered in [catalogue-auto-fill.md](./catalogue-auto-fill.md#25-open-and-public-data) and [vin-decode-cheap-alternatives.md](./vin-decode-cheap-alternatives.md#5-open-type-key-data)                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                |                                                                         |                                                                                                                                                                                                                                                                                                         |
| Brand data (MANN, bilstein, VARTA)       | MANN publishes catalogues and cross reference PDFs on its download hub and supplies structured data through TecDoc, where it is a "Premier Data Supplier" [S] ([press release](https://www.mann-filter.com/uk-en/news-stories/press-releases/2023/mann-filter-awarded-as--premier-data-supplier-.html)). No public data API or feed was found for any of the three [NOT ESTABLISHED] | Unknown                                                                                                                                                                                                                                                                                                        |                                                                         | The written-permission route in [catalogue-auto-fill.md](./catalogue-auto-fill.md#5-recommendation) stands.                                                                                                                                                                                             |
| TecDoc alternatives                      | Covered in [tecdoc-licence-pricing.md](./tecdoc-licence-pricing.md#grey-and-unlicensed-sources-do-not-use) and [fitment-data-sourcing.md](./fitment-data-sourcing.md#2-alternative-vendors): none free and legitimate                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                |                                                                         |                                                                                                                                                                                                                                                                                                         |
| CarQuery API, Open Icecat                | CarQuery's site failed TLS (certificate for another host); Icecat served a bot challenge to the fetch tool                                                                                                                                                                                                                                                                           | **NOT ESTABLISHED**                                                                                                                                                                                                                                                                                            |                                                                         | Not assessed.                                                                                                                                                                                                                                                                                           |

**Bottom line on data.** The free, legitimate sources describe the _vehicle_
(type approval, variant, version, power, capacity), never the _part_ or which
part fits. They can validate our Vehicle table and the type-key rows that
[vin-decode-cheap-alternatives.md](./vin-decode-cheap-alternatives.md#recommendation)
left open for G-series BMWs, but Fitments still come from the crawled brand
pages, our workshop history and permissioned supplier data.

## 5. Recommendations for #399

1. **Write the crawler by hand, small.** Node's built-in `fetch`,
   `robots-parser`, `fast-xml-parser` (or `sax`) plus `node:zlib` for
   sitemaps, and `pg` for the frontier. No Crawlee, no got-scraping, no impit,
   no Playwright. Pin exact versions.
2. **One serial worker per site.** Gap between requests to a host =
   max(`Crawl-delay`, the site's configured floor: 2 s for MANN, FILTRON and
   VARTA, 5 s for bilstein). The four sites can run side by side because they
   are different hosts; MANN and FILTRON share an owner, so consider running
   them one after the other.
3. **Backoff in the frontier, visible in the admin.** On 429 or 503: wait
   `Retry-After` uncapped (date or seconds), else exponential from the floor
   with jitter, and widen the host's gap for the rest of the run. After a few
   consecutive 5xx, pause the run with the reason. On 403, a challenge or
   login page, or a maintenance page where a product page should be: pause,
   do not retry, tell the owner. A 404 marks the URL gone.
4. **robots.txt on every run start and every 24 hours during a run.** 4xx =
   allowed, 5xx or unreachable = pause (RFC 9309 §2.3.1.4). Check every URL
   with `isAllowed` before fetching, even though sitemap URLs should all pass.
5. **Identify honestly.** `User-Agent: CarLabCatalogBot/1.0
(+https://carlab.rs/<bot page>)` and a `From:` address the owner reads. A
   short bot page saying what we fetch, how slowly and how to reach us is
   site copy, so it follows the carlab.rs i18n and `llms.txt` rules; until it
   exists, point the URL at the contact page.
6. **Seed from sitemaps, product URLs only, one locale per site**: FILTRON
   `sr`, bilstein `sr`, VARTA `sr-latn-rs`, MANN `en` (no Serbian locale).
   bilstein's URLs carry only brand and number, so limiting it to stocked
   categories before fetching is not possible from the sitemap [inference];
   limiting by brand segment (`febi`, `swag`, `blueprint`) is.
7. **Schema.** `crawl_run` (site, status, started, paused reason, counts),
   `crawl_url` (site, url unique, status, attempts, next_attempt_at, etag,
   last_modified, sitemap lastmod, http status, fetched_at) claimed with
   `FOR UPDATE SKIP LOCKED`, and the latest snapshot per URL as compressed
   `bytea` with its response headers. Measure gzip vs brotli on 100 MANN
   pages before choosing; budget roughly 5 to 10 GB raw HTML before
   compression for a full first pass.
8. **Recrawls send `If-None-Match` / `If-Modified-Since` but assume 200.**
   Do not skip URLs by sitemap `lastmod` until two snapshots show it tracks
   real changes.
9. **bilstein applicability stays out.** It loads from disallowed paths; a
   browser would only make those requests for us. Take what the server HTML
   gives (criteria, OE references, Serbian names), and ask bilstein if
   applicability is wanted.
10. **Images as URLs, as decided, but not hotlinked on public pages without
    permission.** MANN's legal notice reserves images and texts (#396); the
    stored URL is a pointer for staff and for a later permission, and ADR-0043
    already has staff upload their own photos.
11. **Use RDW and EEA data to check Vehicles, not to fill Fitments.** Pull the
    distinct (make, type, variant, version, cc, kW) rows for BMW and
    Mercedes from RDW (CC0, do not credit RDW) and EEA (CC BY 4.0, credit
    required) and test whether `variant` matches the type key on real
    customer VINs before relying on it.
