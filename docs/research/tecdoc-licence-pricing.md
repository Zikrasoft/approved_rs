# What a TecDoc licence costs a small Serbian webshop

Research date: **2026-10-19**. Follow-up to
[fitment-data-sourcing.md](./fitment-data-sourcing.md) section 1 ("Cost",
"Access and lead time"), which established that TecDoc is the aftermarket
fitment and cross-reference source, that no list price is published, and that
QUANTUM-AutoMARKET in Belgrade is the regional partner. This file does not
repeat those points; it adds the licence terms TecAlliance itself publishes and
every concrete price point found, so the owner can judge a quote when it
arrives. Pilot scope: carlab.rs, BMW B47/B48/N47, consumables first.

## Source status

Same tags as the rest of `docs/research/`:

- **[P]** primary: TecAlliance's own pages and GTC, an official reseller's own
  price page, an app-store listing.
- **[S]** secondary: integrator blogs, news items, search-engine snippets of
  pages that would not render.
- **[NOT ESTABLISHED]** could not be verified.

All currency figures are quoted in the source's own currency and date. Where I
convert to EUR it says so and uses the rate of the source's date; treat those as
orders of magnitude.

## The one-paragraph answer

TecAlliance still publishes **no price for a webshop data licence**, but its own
GTC (v3.2, 2026-04-01) fixes the shape of the deal: a **minimum 2-year term**,
then cancellable only at calendar year-end on 3 months' notice; a **one-time
setup fee** for a 60-day implementation phase; billing annually in advance or,
if revenue-based, quarterly self-reported turnover with audit rights; an
**"Open Access"** licence is required to show data on public (indexable) pages;
Web Service data may be **cached for at most 30 days** and only per user
request; and TecDoc data **may not be used to sell BMW-branded genuine parts**.
The only public price lists for a real webshop API licence come from official
resellers in the CIS: **6,900 to 13,800 RUB/month** for 375 brands or all
brands (ABCP, Russia, Nov 2021), roughly **EUR 1,000 to 2,000/year** at the
time. Workshop catalogue seats (EUR 164 to 219/year, RSD 6,700/quarter in
Serbia) are a different product that **may not feed a shop**. My estimate for
carlab.rs is **EUR 1,500 to 6,000/year plus an unknown setup fee, committed for
2 years**, with **low confidence**: the floor is CIS reseller pricing, the
ceiling is a Western-style annual minimum, and only QUANTUM's quote can settle
it.

## 1. The products, and what each lets you do

| Product                                       | What it is                                                           | May it feed a public shop?                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TecDoc Web Service** (API, "Data Stream")   | Live API: articles, linkages, OE cross-refs, KType                   | Yes, under GTC 1.6 + 1.8 + 1.9 and 2.1 [P]                                                                                                                         |
| **TecDoc Data Package** (TAF / export format) | Bulk files over SFTP, "weekly bulk deliveries" [P]                   | Yes, by individual agreement; storage terms not in the GTC [NOT ESTABLISHED]                                                                                       |
| **TecDoc Catalogue** (web/app seat)           | Workshop lookup UI: Classic, Garage Data, Garage Data Pro            | **No**: "exclusively for the customer's own use", data "may not be reproduced and/or made publicly available" (GTC 2.7.2.2, 2.7.2.5) [P]                           |
| **Catalogue White Label / Reseller Solution** | TecAlliance-hosted catalogue in your branding                        | Yes after a 30-day implementation phase with setup fee (GTC 2.8.1) [P]                                                                                             |
| **Vehicle Identification Service** (VIN/VRM)  | VIN or plate to KType/NType, via web service or inside the Catalogue | Separate product; price and Serbian VIN coverage not published [P] [VIS page](https://www.tecalliance.net/products/cards/vis-vin-vrm), price **[NOT ESTABLISHED]** |
| **TecDoc OE Parts Data** / VIO                | OE numbers from EPCs, vehicle parc                                   | **No public display**: "use ... internally to improve and enrich its own database", public disclosure prohibited (GTC 2.5.2.3, 2.5.2.5) [P]                        |

Sources: [P] [TecAlliance, data users](https://www.tecalliance.net/tecdoc-data-user/);
[P] [TecAlliance GTC v3.2, 2026-04-01 (PDF)](https://dwnld.aws.tecalliance.com/GTC/GTC-EN.pdf).

So the OE Parts Data product does **not** buy the germsp.ru-style OEM view for
public pages; that still has to come from elsewhere (see the Parts-Catalogs
route in [fitment-data-sourcing.md](./fitment-data-sourcing.md#recommendation-for-the-bmw-20-l-pilot)).

### Licence terms that matter for carlab.rs (GTC v3.2, all [P])

- **Open vs Restricted Access.** "Restricted Access": data only for users known
  to the customer behind a login, "any disclosure ... even partial, outside the
  restricted user group is prohibited". "Open Access": "may be published
  without restriction on the user group" (1.6.3, 1.6.4). **Public, indexable
  fitment pages need Open Access**; ask for it by name. Restricted Access also
  bars use in ads, price-comparison and social channels (2.1.2.9).
- **Storage and caching (Web Service).** "Access to the database ... must
  always be made via the Web Service"; temporary caching is allowed only for
  user requests, until the next data update, "no longer than thirty (30) days";
  usage-billed data (per click, per retrieval) "may not be cached" (1.9.1,
  1.9.2). So pre-rendering every BMW fitment page into a static build from the
  API is outside the standard terms; a static/SSG catalogue needs the Data
  Package or a written exception. Whether a Data Package licensee may hold the
  full set in its own DB is not in the GTC **[NOT ESTABLISHED]**; the
  [customer FAQ](https://www.tecalliance.net/tecalliance-customer-contract-faqs/)
  says caching "may be permitted only within the limits set out in the
  applicable agreement" [P].
- **What may be shown.** Only for items the shop "actually sell[s]" (generally
  carried is enough) (2.1.2.5); brand name, article number and restrictions
  must be shown (2.1.2.6); OE and competitor cross-references only "within the
  provided mapping", no self-made cross-refs (2.1.2.8).
- **No genuine BMW parts.** "Use of the product data for original replacement
  parts from automobile manufacturers is prohibited" (2.1.2.4). TecDoc can show
  that a Mann filter replaces BMW 11 42 8 575 211, but not power a page selling
  the BMW-branded filter.
- **New or branded remanufactured parts only**, no used parts (2.1.2.2, 2.1.2.3).
- **Disclosure.** "TecDoc inside" logo (min 100 px wide) and the copyright note
  on the shop homepage; a fitment disclaimer; data version shown (2.1.3, 2.1.4).
- **Marketplaces.** Selling on a third-party platform with TecDoc data only if
  that platform is TecAlliance-licensed and named in the project (2.1.2.10).
- **Service providers** (our dev agency, hosting) need TecAlliance's NDA and
  consent, granted within 30 business days (1.6.5). **AI/ML training on the
  data is prohibited** (1.6.6).
- **Term.** Indefinite, "minimum of two (2) years", then end of calendar year
  with 3 months' notice (1.10.3). Implementation phase does not count toward it
  (1.8.4).
- **Fees.** One-time setup fee for the 60-day implementation phase, no licence
  fee during it (1.8.1 to 1.8.3). Continuing services billed annually,
  pro-rata for a started year, 30 days' payment (1.16.3, 1.16.4). If
  revenue-based, turnover reported on 5 Jan/Apr/Jul/Oct, audit at TecAlliance's
  cost unless the gap is over 3% (1.16.2). Unilateral price adjustment with a
  6-week objection window (1.17).
- **Penalty.** Contractual penalty per culpable breach, not less than EUR
  10,000 for IP infringement (1.11.2). Delete everything on termination (1.12).
- **Via a partner.** A contract through an authorised partner (QUANTUM) pulls
  these GTC in, and they win over the partner's terms on conflict (1.3.2).

## 2. Every concrete price point found

### Webshop / API data licences (the relevant ones)

| Source                                                                                                                                        | Date         | Product                                       | Price                                                                                                                                                                 | Tag |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| [ABCP (authorised TecAlliance reseller), Russia](https://www.abcp.ru/news/TecDoc-menyaet-tarifyi-i-limityi-s-1-noyabrya)                      | from 2021-11 | TecDoc API, 375 brands, 50,000 calls/day      | **6,900 RUB/month** (about EUR 84 at the time)                                                                                                                        | [P] |
| same                                                                                                                                          | from 2021-11 | TecDoc API, all brands, 80,000 calls/day      | **13,800 RUB/month** (about EUR 168)                                                                                                                                  | [P] |
| same                                                                                                                                          | to 2021-10   | API 200 brands / 650 brands, 30,000 calls/day | 6,000 / 12,000 RUB/month                                                                                                                                              | [P] |
| [AGV Aftermarket (official CIS partner) via westoil.ru](https://www.westoil.ru/Content/News/5516)                                             | 2020-06      | "single package" TecDoc API                   | "about USD 100", period not stated                                                                                                                                    | [S] |
| [AGV Lab, tecdoc-cis.com](https://tecdoc-cis.com/) (Ukraine + CIS ex. RU/BY)                                                                  | current      | TecDoc API                                    | on request; "from 80,000 requests/day", pay from 3 months                                                                                                             | [P] |
| [Optiseller + TecAlliance, UK](https://channelx.world/2019/12/optiseller-give-cost-effective-tecdoc-catalogue-access-for-auto-parts-traders/) | 2019-12      | modular licence, first 5,000 products         | GBP 600/year (already in the fitment file)                                                                                                                            | [S] |
| [moto-firma.pl (mSklep)](https://moto-firma.pl/m.asp?t=3), Poland                                                                             | current      | shop software with TecDoc search              | PLN 8,300 + VAT one-off for the software; TecDoc fee separate, "dependent on declared turnover and the number of TecDoc brands used, set individually by TecAlliance" | [P] |
| [tricoma / German integrators](https://www.tricoma.de/Lieferanten/TecDoc-Connector/)                                                          | current      | model only                                    | price depends on data volume, modules and number of countries; floor applies even with zero revenue                                                                   | [S] |

The ABCP tiers are the only public, official, per-month webshop API prices I
found. They are Russian-market pricing from before 2022; whether TecAlliance
still serves Russia, and whether Balkan pricing resembles CIS pricing, is
**[NOT ESTABLISHED]**. Note the scoping unit there is **number of brands and
calls per day**, which matches the Polish "turnover + number of brands" model.

### Catalogue seats (not usable for a shop, listed so they are not confused)

| Source                                                                                                                                                                       | Date            | Price                                                                        | Tag |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- | --- |
| [QUANTUM-AutoMARKET, Serbia](https://www.automarket.rs/sr/TecAlliance/PlanDetails?planId=1&t=q)                                                                              | 2026-10         | TecDoc Web Katalog **RSD 6,700/quarter**                                     | [P] |
| [WTS Magyarország, Hungary](http://tecdoc.wtsmagyarorszag.hu/order)                                                                                                          | 2026-10         | EUR 169 net/year, one user (EUR 164 in the earlier snippet)                  | [P] |
| [AGV Lab, CIS](https://webcat.tecdoc-cis.com/billing)                                                                                                                        | from 2023-04    | USD 21/month main seat, USD 18 extra seat, min 3 months                      | [P] |
| [Vortex, Ukraine](https://crm-vortex.com/tecdoc-license)                                                                                                                     | 2024            | EUR 25/month, paid yearly                                                    | [P] |
| [Pesta / Integra, Poland](<https://sklep.integra.com.pl/czesc/tecdoc-web-catalog-2_5-(abonament-12-mies_)-tecalliance-gmbh%2C2032-01_12%2Ctecalliance-gmbh%2C01%2001%20126>) | current         | PLN 855 net / 12 months                                                      | [S] |
| [TecAlliance shop](https://shop.tecalliance.net/tecdoc-catalogue-garage-data/5637251097.p)                                                                                   | 2026-10         | price behind login; 12-month auto-renewing subscription (GTC 1.24.5, 1.24.6) | [P] |
| [TecDoc Catalogue iOS app](https://apps.apple.com/us/app/tecdoc-catalogue/id1475452878)                                                                                      | v3.1.1, 2024-04 | USD 9.99/month, 3.49/week; repair data 17.99/month                           | [P] |
| [ABCP, Russia](https://www.abcp.ru/news/Oficialnaya_versiya_kataloga_TECDOC_dostupna_dlya_pokupki_na_platforme_ABCP)                                                         | 2014-05         | 2,000 RUB/month catalogue licence                                            | [P] |

Useful for staff lookups (the VIN-inquiry fallback) at about EUR 170/year, not
as a data source for the site.

### Shop plugins (licence never included)

- **Mecaparts PRO (Shopify):** USD 99 / 199 / 399 per month for 2,500 /
  25,000 / unlimited products; the merchant must "hold a TecDoc contract with
  TecAlliance". [P] [Shopify App Store](https://apps.shopify.com/mecaparts-pro)
- **TecGento (Magento), aromicon:** aimed at shops with EUR 1 m to 200 m
  online turnover a year; no prices. [S] [aromicon](https://www.aromicon.de/loesungen/tecdoc-magento/)
- **nsystems.ro, Romania:** "official TecAlliance distributor", sells shop +
  TecDoc licence, no prices. [P] [nsystems.ro](https://www.nsystems.ro/en/tecdoc-en/)

No plugin found bundles the data licence into its price.

### Grey and unlicensed sources (do not use)

- **"Auto Parts Catalog, TecDoc API alternative"** (making-data-meaningful,
  on RapidAPI and Apify): Basic free (100 req/month), Pro USD 29, Ultra USD 59,
  Mega USD 299/month; Apify listing USD 69/month + usage. [S] search snippets of
  [RapidAPI](https://rapidapi.com/makingdatameaningful/api/auto-parts-catalog/pricing)
  and [Apify](https://apify.com/making-data-meaningful/tecdoc) (the Apify page
  now returns 404). No claim of a TecAlliance licence found. TecAlliance grants a
  "non-exclusive, nontransferable, and non-sublicensable" right (GTC 1.6.2) and
  forbids transfer to third parties (1.6.6), so a pay-per-call reseller of
  TecDoc-shaped data is either not TecDoc or not licensed for our use
  **[NOT ESTABLISHED which]**.
- **Database dumps** such as "TECDOC 2025" for EUR 2,000 or 180,000 RUB
  ([autodatabases.ru](https://autodatabases.ru/TECDOC2025.html), [S]) are
  pirated copies; see the leaked-repo note in
  [platform-survey.md](./platform-survey.md). Public use exposes the shop to
  the EUR 10,000+ penalty clause.

## 3. Minimums, fees and lead time

| Item                     | Finding                                                                                                 | Tag                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Contract length          | min 2 years, then year-end with 3 months' notice (GTC 1.10.3)                                           | [P]                                                                          |
| Setup fee                | exists, one-time, for the 60-day implementation phase; amount not published                             | [P] / amount [NOT ESTABLISHED]                                               |
| Annual minimum           | German integrators confirm a floor even at zero revenue; amount not published                           | [S] / amount [NOT ESTABLISHED]                                               |
| Turnover percentage      | the model exists (GTC 1.16.2, mSklep); the rate is not published anywhere I found                       | [P] / rate [NOT ESTABLISHED]                                                 |
| Scoping unit             | brands (ABCP tiers, mSklep), product count (Optiseller), languages and countries (GTC 2.1.2.1, tricoma) | [P]/[S]                                                                      |
| VIN add-on               | separate product (VIS); price, billing and Serbian coverage not published                               | [NOT ESTABLISHED]                                                            |
| Languages                | licence covers "the agreed languages"; Reference Data in 42 languages                                   | [P]                                                                          |
| Refresh                  | Web Service real-time; Data Package weekly; QUANTUM's own webshop systems monthly since 2019            | [P] [automarket.rs](https://www.automarket.rs/en/DocumentArchive/Article/19) |
| Lead time                | contract to account data not published; then up to 60 days implementation before going live             | [P] / contract time [NOT ESTABLISHED]                                        |
| Company-size requirement | none in the GTC; GTC excludes consumers (1.2.4), so a registered company is needed                      | [P]                                                                          |

## 4. Cheaper legitimate routes

1. **Brand-scoped licence.** The scoping unit is brands, so ask for only the
   brands carlab.rs will stock for the pilot (Mann, Mahle, Bosch, Febi,
   Meyle, Lemförder, etc.: roughly 10 to 20). The ABCP tiers show brand count
   drives price; whether QUANTUM offers a sub-375-brand tier is
   **[NOT ESTABLISHED]**.
2. **QUANTUM's own webshop systems.** QUANTUM states TecDoc data in "our
   Webshop systems" has been refreshed monthly since 2019, and it sells the
   TecDoc export format "with discounts" as territory representative [P]
   ([automarket.rs product page](https://www.automarket.rs/sr/Product/TecDoc)).
   A hosted shop or white-label catalogue from them may already carry the
   licence; worth asking before building our own integration.
3. **TecDoc White Label / Reseller catalogue.** TecAlliance hosts the
   catalogue, we brand it and link to our product pages. Lower build cost;
   but it is TecAlliance's domain and UI, so it gives carlab.rs little SEO
   [S, inference from GTC 2.8].
4. **Inter Cars.** Inter Cars is a TecDoc consumer and passes only the TecDoc
   article id, not the linkage ([intercars-ecat-api.md](./intercars-ecat-api.md)).
   Its licence cannot be sublicensed to us (GTC 1.6.2). No evidence of an
   Inter Cars sublicence programme **[NOT ESTABLISHED]**.
5. **Restricted Access first.** If public pages are not needed in month one
   (staff-assisted VIN inquiry stays the front door), a Restricted Access
   licence for logged-in staff/customers may be cheaper; price difference
   **[NOT ESTABLISHED]**.
6. **Catalogue seat only.** EUR 170/year for staff to look up fitment and OE
   cross-refs by hand while the public site stays on the inquiry form. Legal
   for internal use, useless for the storefront.

## 5. Bottom line for the carlab.rs pilot

**Estimate (mine, not a quote): EUR 1,500 to 6,000 per year for an Open Access
Web Service licence scoped to the pilot's brands, plus a one-time setup fee of
unknown size, committed for 2 years (so EUR 3,000 to 12,000 total exposure).
Confidence: low.**

- Floor: ABCP's official all-brands API at about EUR 1,000 to 2,000/year
  (2021) and the Optiseller GBP 600/year modular licence (2019).
- Ceiling: the Western integrator range ("a few thousand to tens of thousands
  of euros in the first year" including build, [fitment file](./fitment-data-sourcing.md#cost))
  and the German statement that a floor applies regardless of revenue.
- Things that would push it up: Open Access, VIN add-on, Data Package (for a
  static build) instead of Web Service, more languages, all brands.

### Questions to email QUANTUM-AutoMARKET (office@automarket.rs)

1. Price of a **TecDoc Web Service** licence for a Serbian company running a
   B2C webshop (carlab.rs), **Open Access** (public, indexable pages), passenger
   cars only, Serbian + English (+ Russian?), scoped to a list of ~15 brands we
   attach. Annual fee, one-time setup fee, any annual minimum, any turnover
   percentage and its rate.
2. Same quote for **all brands**, and for **Restricted Access**, to see the
   step sizes.
3. Is there a **brand-count or product-count tier** below the full catalogue
   (like ABCP's 375-brand tier or Optiseller's 5,000-product licence)?
4. **Data Package (export format)** instead of Web Service: price, refresh
   frequency, and written confirmation that we may store it in our own
   database and pre-render static product/fitment pages from it.
5. If Web Service only: may fitment pages be pre-rendered and cached beyond
   the 30-day limit of GTC 1.9.2, or must each page call the API live?
6. **VIN/VRM search** (Vehicle Identification Service): price model (per
   request or flat), does it decode **Serbian-registered BMWs** and
   grey-import VINs, and can its results be cached?
7. Contract: confirm the 2-year minimum (GTC 1.10.3), whether a 1-year pilot
   term is possible, the contracting party (QUANTUM or TecAlliance GmbH),
   currency (EUR or RSD) and invoicing.
8. Time from signature to API credentials, and whether the 60-day
   implementation phase can start on a test account before payment.
9. Do QUANTUM's own **webshop systems or white-label catalogue** include the
   data licence, and at what price? Can they link to our own product pages?
10. Company requirements: any minimum size, turnover or years of trading for
    a new d.o.o. or preduzetnik?
11. Is display of OE cross-references (e.g. "replaces BMW 11 42 8 575 211")
    included in the standard Catalogue Data licence, given GTC 2.1.2.8?
12. Consent process for our developer/hosting provider under GTC 1.6.5.
