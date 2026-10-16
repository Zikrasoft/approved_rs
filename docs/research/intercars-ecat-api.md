# Intercars (Inter Cars S.A.) B2B/dropship integration — what's publicly known

Research for ticket [#323](https://github.com/Zikrasoft/approved_rs/issues/323).
Best-effort/public research only — no Intercars credentials, sandbox, or NDA
material in hand. Follow-up with real API access is #328. Date: 2026-10-16.

## Source status

Tags used below:

- **[P]** — primary source read directly (Intercars' or TecAlliance's own
  pages/docs).
- **[S]** — secondary source (blog, case-study write-up, third-party repo);
  the real primary doc was not reachable.
- **[EXTRAPOLATED]** — no Intercars-specific source found; this is the
  general pattern for this class of system, stated as such.
- **[UNKNOWN]** — could not determine at all.

## 1. What Intercars exposes for B2B/dropship integration

Intercars runs (at least) **two separate, publicly documented integration
surfaces** — this is itself worth noting, since conflating them would be a
mistake:

### 1a. "IC API" — the current REST API

Primary docs are live at **https://docs.webapi.intercars.eu/ic-api/en/** [P],
with a machine-readable contract browsable at
**https://docs.webapi.intercars.eu/ic-api/contracts/api** [P]. Quoting the
intro page: "IC API provides, via public REST services, ... full support for
the sale of IC products **in Poland and abroad**" — i.e. it is not
Poland-only, but the docs don't enumerate which of Intercars' 26 served
countries (Serbia included — Intercars itself cites Serbia as one of its
fastest-growing markets, 82% YoY sales growth in Q1 2023) are actually live on
this API versus still CSV/legacy-only. **[UNKNOWN]** whether Serbia
specifically is provisioned on this API today — that's a real question for
#328 to ask Intercars directly, not something the public docs answer.

The contract page documents a conventional REST surface organized around:

- **Catalog** — `GET /ic/catalog/category`, `GET /ic/catalog/products`
  (search by category/SKU/index; paginated, default page size 25, max 100).
- **Inventory** — `GET/POST /ic/inventory/stock` and `POST
/ic/inventory/quote`: stock by SKU/index, **returned per warehouse
  location** (`location` param, max 10 locations), including
  `latestDeliveryDate`, `orderDateTimeTo` (order cutoff), and
  `customerRouteStartDateTime`/`customerRouteCode`. Max 100 SKUs per call.
- **Pricing** — `POST /ic/pricing/quote`: net/gross list and customer
  price, VAT, max 100 SKUs (one summary source said 30 for this specific
  endpoint — flagging the discrepancy rather than picking one).
- **Sales/requisition** — `POST /ic/sales/requisition` (create order),
  confirm/cancel, `GET /ic/sales/order/{id}`.
- **Delivery** and **Invoice** — read endpoints, 2-day max date-range window
  per search call, pagination capped at 50–200 depending on endpoint.
- **Customer** — account/addresses/finances (balance, credit limit).

This is the single most useful concrete finding for carlab.rs's purposes: **a
real, documented Intercars REST endpoint already returns per-warehouse stock

- delivery-date data in one response shape** (see §6).

### 1b. The older "IC_Katalog ONLINE" API

A different, simpler surface exists under `katalog.intercars.com.pl/api/v2/`,
documented only informally (a third-party GitHub repo,
`gearcodegit/Inter-Cars-Api-Tester` [S], shows a `GetInvoice`/`GetInvoices`
call authenticated with two plain headers, `kh_kod` — customer number — and
`token` — a long-lived token generated from the IC_Katalog ONLINE web UI
under Settings → "Share documents online" → Generate token). This looks
narrower in scope (invoices only, in the example found) and is likely a
legacy/parallel system rather than the one to integrate against going
forward. **[S]**, unverified against an official doc page for this specific
surface.

### 1c. CSV/flat-file option

Intercars' own marketing page for the integration offering
(`intercars.com/en/business-solutions-inter-cars/business-services/software/api-and-csv-client-inter-cars`,
title "API & CSV Integration") states customers can instead download **CSV
files with stock levels and prices** from
**https://data.webapi.intercars.eu/customer** after being issued an access
password [S — page itself returned 403 to automated fetch; description is
from the page's indexed/cached summary, not a direct read]. The same page
notes **the API itself is free to use, but implementation cost is on the
customer's side**, and that for a short list of named workshop-management
software products (asco, integra, motowarsztat, nextis, falcon cairo,
warsztat24, motoFirma) Intercars already has ready-made integrations, so no
custom work is needed if carlab.rs ever used one of those (it won't, but
worth knowing the shape of their partner ecosystem).

### 1d. B2B storefront architecture (context, not an API)

Intercars' main B2B ordering portal (e-katalog, including the Serbian
`rs.e-cat.intercars.eu`) runs on **SAP Hybris Commerce**, built by e-point
across 16 countries [S — e-point's own case-study write-up, a vendor talking
about their own work, so first-party for _that vendor_ but secondary for
Intercars]. This is the human-facing ordering UI, not necessarily the same
backend surface as the IC API above, though they likely share the same
warehouse/stock systems underneath.

## 2. Auth model

**For IC API specifically:** the intro doc states only that "all IC API
operations are protected and require registration of a dedicated client
account" [P] — it does not spell out the exact grant type on the pages
reachable without a login. No OAuth2 flow name, token endpoint, or
client_id/secret language was found on the public pages. A **test
environment** is explicitly mentioned (sandbox-before-production), and
Postman collections are provided for would-be integrators [P]. This is
genuinely incomplete from public docs alone — **getting the actual auth flow
is a #328 item** (see Unknowns).

**For IC_Katalog ONLINE (the older surface):** confirmed simple pattern —
static `kh_kod` (customer number) + `token` (opaque bearer-like token,
generated once via the web UI, not re-displayable) sent as plain headers
[S]. No refresh flow, no scopes visible.

**Industry norm for this class of system [EXTRAPOLATED]:** large CEE/EU auto
parts distributors running B2B dropship programs for workshops/webshops
typically offer one of: (a) REST + API-key or OAuth2 client-credentials
(increasingly the default for anything built in the last ~5-8 years, which
matches Intercars' newer IC API using a modern REST shape with a declared
test environment), (b) a long-lived static token/customer-number pair for
older or narrower-scope systems (matches what's documented for IC_Katalog
ONLINE), or (c) EDI/flat-file (CSV, sometimes via SFTP) for the lowest-effort
tier, which Intercars also explicitly offers. Seeing a distributor expose
_both_ a modern REST API and a CSV fallback in the same breath, as Intercars
does, is itself a common pattern — the CSV tier exists specifically for
integrators who don't want to build against the REST contract.

## 3. Push vs pull, and refresh cadence

No Intercars documentation found describes **webhooks or any push mechanism**
— every endpoint in the IC API contract is a client-initiated GET/POST; stock
and price are pulled via `/ic/inventory/stock`, `/ic/inventory/quote`,
`/ic/pricing/quote` on demand [P]. The intro doc's own warning — "excessive
API usage, especially for **cyclical stock updates**, may generate
unnecessary network traffic" and risks "exceeding hourly or daily
communication limits" [P] — directly implies the intended integration pattern
_is_ polling on some cycle chosen by the integrator, not a push subscription.
If Intercars had a webhook/push product, this warning wouldn't be phrased
this way.

**Typical cadence for this class of system [EXTRAPOLATED, no Intercars-specific
number found]:** full-catalog price/stock pulls are commonly done nightly or
a few times a day; **availability for SKUs in an active cart/checkout flow**
is typically re-queried synchronously at time of need (exactly the shape
`/ic/inventory/stock` and `/ic/inventory/quote` support — a 100-SKU
synchronous lookup fits a cart/checkout call, not a catalog crawl). A
reasonable design for carlab.rs, pending real numbers from #328: cache
price/availability from a scheduled batch pull for browsing/search, and do a
live `/ic/inventory/quote`-style re-check at add-to-cart/checkout time for the
specific SKUs in play — this is a common pattern for this class of
integration generically, not something confirmed Intercars-specific.

## 4. Rate limits / batch-size norms

**Concretely documented by Intercars' own contract docs [P]:**

| Endpoint                                       | Batch limit documented                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/ic/inventory/stock`, `/ic/inventory/quote`   | up to 100 SKUs per call; up to 10 warehouse `location`s per call                                                                |
| `/ic/pricing/quote`                            | up to 100 SKUs per call (one source said 30 for this specific endpoint — unresolved discrepancy, flagging rather than guessing) |
| `/ic/catalog/products`                         | pagination default 25 / max 100 per page                                                                                        |
| `/ic/delivery`, `/ic/sales/requisition` search | 2-day max date window; pagination default 20, max 50                                                                            |
| `/ic/invoice` search                           | 2-day max date window; pagination default 20, max 200                                                                           |

**No numeric requests-per-hour/day figure is published anywhere found.** The
intro page only says excessive cyclical polling "may lead to exceeding hourly
or daily communication limits" **without stating what those limits are** [P].
**Do not invent a number here** — it is genuinely undocumented publicly, and
is a direct, concrete question for #328 (ask Intercars for the actual
req/hour or req/day ceiling in writing before building a sync job against
it).

## 5. Fitment/VIN data: Intercars' own, or TecDoc layered on top?

**Confirmed: Intercars is a TecDoc _consumer_, not a TecDoc data owner.**
TecAlliance's own customer-story page about Intercars states "TecDoc data
[is] part of their daily processes" and that Intercars also uses **TecCom**
(TecAlliance's B2B order-automation network) "to automate express ordering
and standardize supplier communication" with its own upstream suppliers [P —
TecAlliance's own site, first-party for TecAlliance, describing Intercars as
their customer]. TecAlliance's general product pages independently confirm
TecDoc itself is "the primary European reference database for fitment data
... maintained by TecAlliance" across ~7M parts / ~700 manufacturers [P].

So to directly answer the "well-known industry fact worth verifying" framing
in the brief: **yes, it checks out** — Intercars' own catalog/fitment search
(the IC_Katalog, the e-cat portals including the Serbian one) is built on top
of licensed TecDoc fitment data, the same way essentially every non-OEM
parts-by-VIN catalog in Europe is; Intercars does not appear to maintain an
independent, proprietary VIN-fitment graph of its own. This matters directly
for carlab.rs: **if/when Intercars API access lands, fitment-by-VIN still
likely needs to come from a TecDoc-licensed source (either Intercars passing
through TecDoc data in its own catalog responses, or carlab.rs licensing
TecDoc separately) — it is not something you can assume Intercars' stock/price
API alone will give you**, since the documented IC API endpoints above
(`catalog`, `inventory`, `pricing`) describe SKU/category search, not vehicle
fitment search. **[UNKNOWN]** whether the IC API's `/ic/catalog/products`
endpoint accepts a VIN or vehicle-fitment query param at all — the contract
summary pulled here didn't surface one; this needs direct inspection of the
full contract page (it's large; a targeted follow-up read, or #328 with real
access, should check this specifically) or the full contracts/api page with the
actual OpenAPI/Swagger spec, not a summarized fetch.

## 6. Multi-tier lead-time/availability per article: distributor stock structure or reseller-side tiering?

First, a correction to the premise worth flagging explicitly: **germsp.ru, on
inspection, is not an Intercars reseller** — it's a Russian OEM BMW/MINI/
Rolls-Royce parts importer with its own Moscow warehouse, unrelated to
Intercars or the CEE aftermarket distribution chain [P — fetched the site
directly]. So it can't be used as a _specific_ worked example of Intercars'
own tiering. Treating it instead as a generic illustration of "a reseller
shows several delivery-time rows per article," the question still stands and
is answerable from what Intercars' own API documents:

**The pattern — several lead-time tiers per SKU — is a direct reflection of
multi-warehouse distributor stock, not an artifact invented by the reseller
UI.** This is not extrapolation for Intercars specifically: the IC API's own
`/ic/inventory/stock` and `/ic/inventory/quote` endpoints are documented to
return **availability broken out per warehouse `location`** (up to 10
locations per call), each location carrying its own `latestDeliveryDate` and
route/cutoff fields (`orderDateTimeTo`, `customerRouteStartDateTime`,
`customerRouteCode`) [P]. That is exactly a per-warehouse
quantity-plus-lead-time structure, straight from Intercars' own API contract.
Separately, Intercars' public logistics material describes a tiered
hub/midi-hub network (European Logistics Centre + regional hubs) with
stated customer-facing delivery windows as coarse as "48h / 72h / 3-5 days /
7-14 days / 14+ days" depending on which tier of the network holds the stock
[S — marketing page, not the API contract, but consistent with the API
shape]. So a reseller UI that shows "3 units in 2 days, 12 units in 5 days,
40 units in 2 weeks" for one article is, with very high plausibility,
surfacing exactly this kind of per-warehouse stock+lead-time array rather
than inventing its own tiering logic.

**General industry pattern, independently [EXTRAPOLATED]:** this is also
just how large multi-warehouse B2B distributor feeds are conventionally
modeled in EDI/API integrations generally (not Intercars-specific) — a stock
response is an array of `{warehouseId, quantity, leadTimeDays/eta}` tuples
per SKU, and the consuming storefront either shows them all, or collapses
them into "fastest available" / "if you need more than X, add Y days." A
reseller _can_ additionally layer its own buffer/safety-stock logic on top
(e.g. hiding a remote warehouse's stock unless the nearest ones are
insufficient), but the _existence_ of multiple tiers per article is best
explained by the upstream multi-warehouse feed, not reseller invention.

## References

- https://docs.webapi.intercars.eu/ic-api/en/docs/documentation/Intro — IC API intro [P]
- https://docs.webapi.intercars.eu/ic-api/contracts/api — IC API endpoint contracts [P]
- https://intercars.com/en/business-solutions-inter-cars/business-services/software/api-and-csv-client-inter-cars — API & CSV integration offering [S, fetch blocked, summary from indexed content]
- https://intercars.com/en/business-solutions-inter-cars/business-services/software/api-and-csv-employee-inter-cars — same offering, employee-facing variant [S, fetch blocked]
- https://github.com/gearcodegit/Inter-Cars-Api-Tester — third-party example of the older IC_Katalog ONLINE token auth [S]
- https://www.tecalliance.net/resources/customer-stories/inter-cars-scales-automation-with-teccom — TecAlliance's own case study confirming Intercars uses TecDoc + TecCom [P, first-party for TecAlliance]
- https://www.tecalliance.net/products/cards/tecdoc-catalogue — TecDoc product description, general fitment-data structure [P]
- https://www.e-point.com/blog/b2b-e-commerce-for-inter-cars-how-we-developed-an-sap-hybris-commerce-based-system-for-16-countries — vendor case study on Intercars' SAP Hybris B2B portal architecture [S]
- https://intercars.com/en/logistics — Intercars' own logistics/hub network page, delivery-tier language [S]
- germsp.ru — fetched directly to check the premise; confirmed unrelated to Intercars [P, negative result]

## Unknown — pending real API access (#328)

These cannot be answered from public material and should be the direct
question list once Intercars grants real docs/sandbox/credentials:

1. **Exact auth flow for the current IC API** — grant type (OAuth2
   client-credentials? static API key? something else), token lifetime,
   whether Serbia-market access is provisioned separately from Poland.
2. **Whether Serbia (`rs.e-cat.intercars.eu`) is actually live on the IC API**
   today, or whether Serbian B2B accounts are still CSV/legacy-only.
3. **The real numeric rate limit** (requests/hour or /day) — publicly, only
   the existence of a limit is acknowledged, never the number.
4. **Whether `/ic/catalog/products` (or any endpoint) supports a VIN or
   vehicle-fitment query**, or whether fitment search is entirely out of
   scope for the IC API and would require a separate TecDoc license on
   carlab.rs's side even after Intercars API access is granted.
5. **Whether price/stock responses from `/ic/inventory/quote` include
   Intercars' own margin/cost basis transparently enough to compute a
   reliable markup**, or whether list price already bakes in a volume/tier
   discount structure that needs separate negotiation.
6. **Whether a webhook/push option exists that simply isn't publicized**
   (unlikely given the explicit polling-warning language, but worth asking
   directly rather than assuming from the public docs alone).
7. **The actual discrepancy in max-SKU-per-call for `/ic/pricing/quote`**
   (100 vs 30 in different summarized sources) — resolve against the real
   OpenAPI/Swagger spec once reachable with credentials.
8. **Order placement / cancellation semantics for a dropship flow
   specifically** — the documented `/ic/sales/requisition` flow
   (create → confirm/cancel) reads like it's designed for a workshop buying
   for itself, not necessarily for a reseller placing orders on behalf of
   end customers with a different ship-to each time; needs direct
   confirmation this flow supports drop-shipping to a third-party address at
   all.
