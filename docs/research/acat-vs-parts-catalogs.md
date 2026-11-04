# ACAT (acat.online) vs Parts-Catalogs: should carlab.rs buy either?

Research date: **2026-10-21**. Question from the owner: he found
[acat.online](https://acat.online/) and
[parts-catalogs.ru](https://www.parts-catalogs.ru/ru) and is willing to pay for
one. What does each sell, can a Serbian company buy it, and what may we do with
the data under ADR-0039/0040/0041? Background already covered elsewhere and not
repeated here: [fitment-data-sourcing.md](./fitment-data-sourcing.md) (first
look at Parts-Catalogs, the BMW ETK provenance problem),
[tecdoc-licence-pricing.md](./tecdoc-licence-pricing.md),
[catalogue-auto-fill.md](./catalogue-auto-fill.md),
[intercars-ecat-api.md](./intercars-ecat-api.md), the ADRs
[0039](../adr/0039-own-catalogue-data-staff-maintained-vehicles.md),
[0040](../adr/0040-one-catalog-module-vehicle-reference-tables.md),
[0041](../adr/0041-part-attributes-requirements-supersession.md) and terms in
[GLOSSARY.md](../../GLOSSARY.md).

Not legal advice. Contract and sanctions points need a Serbian lawyer and the
owner's bank before money moves.

## Source status

- **[P]** primary: the vendor's own page, API documentation, offer or terms,
  read in this session.
- **[S]** secondary: news, search snippets, third-party pages.
- **[NOT ESTABLISHED]** could not be verified.

## The one-paragraph answer

Both are the same kind of product: **Russian-made OEM catalogues** (exploded
diagrams, numbered positions, OEM numbers, VIN/frame search) sold as an
embeddable widget or a REST API to parts shops, with **no aftermarket cross
references** of their own. Both cover BMW and Mercedes-Benz, neither offers
Serbian, and neither claims a licence from BMW or Mercedes. **ACAT should not be
bought**: it is sold only in roubles by a Yekaterinburg company under Russian
law, its published bank is under US and EU sanctions [S], and its licence
forbids exporting data into other software (5.2.13), which is exactly what
feeding OEM numbers into Inter Cars would be. **Parts-Catalogs is the only
candidate**, through Tradesoft Global LLC (a Wyoming LLC that bills in USD/EUR by
card or invoice), and only for two uses: a staff lookup tool and a live,
noindex VIN-to-diagram view that hands OEM numbers to our Inter Cars price
lookup. Using it to fill our own stored catalogue is forbidden by its terms
(12.1: no bulk download or "systematically harvest catalog data"). Public,
indexable pages built from either vendor's data are not granted by either
licence. If bought, start with the 1,000-request tier after the free 2-day
demo, and only after the written answers listed at the end.

## 1. What each product is

| Question                     | ACAT (АвтоКаталог Online)                                                                     | Parts-Catalogs (Tradesoft)                                                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data type                    | OEM catalogues: groups, diagrams, numbered labels, part numbers [P]                           | OEM catalogues: groups tree, diagrams, positions, part numbers [P]                                                                                                                                                                                |
| Aftermarket cross references | None found. Number/name search exists only for some makes (`searchParts` flag) [P]            | None of its own. The widget's "data with analogs" view shows analogs that **our** price server returns [P]                                                                                                                                        |
| BMW / Mercedes               | Both listed, both marked "VIN search available" [P] [catalogue](https://acat.online/catalogs) | BMW listed on every site [P]; Mercedes-Benz named in the docs' brand-package example ("BMW, AUDI, MERCEDES-BENZ, VOLKSWAGEN, PORSCHE") and on tradesoft.ru [P]. The EU page shows 49 brands vs 101 on the RU page: EU scope **[NOT ESTABLISHED]** |
| Coverage claimed             | 400+ makes incl. trucks, buses, special machinery, motorcycles [P]                            | RU: 101 makes, 3,560 models, 25M parts; EU: 49 makes, 1,910 models [P]                                                                                                                                                                            |
| Languages                    | API `lang`: ru, en, de, bg, fr, es, he. No Serbian [P]                                        | API: ru, en, cs, de, es, fr, he, lt, ro, sk, tr, uk; defaults to en. No Serbian; "for an additional language contact sales" [P]                                                                                                                   |
| Updates                      | "Regular" [P]                                                                                 | "Monthly" (marketing page); per catalogue, freshness returned by `/v1/catalogs` [P]                                                                                                                                                               |

**VIN decoding depth.** Neither documents BMW or Mercedes specifics. ACAT's
`VinDTO` returns make, model, modification, a free-form `parameters[]`
(name/value) list and an opaque `criteria` string that filters groups and parts
afterwards [P]. Parts-Catalogs' `GET /v1/car/info?q=<VIN>` likewise returns the
car, free-form parameters and a `criteria` string; its documented example is a
Skoda (years, a code, door count), and its BMW modification example shows model
`116i`, series `E87`, year and region filters [P]. Whether either exposes the
BMW type code, production date, SA option codes, or the Mercedes Baumuster and
code list is **[NOT ESTABLISHED]**; the demo has to show it (test VINs below).

**A provenance hint, not proof.** Parts-Catalogs' documented BMW diagram image
lives under `bmw_2020_01/data/JPG/` [P], which matches the "ETK 01/2020" dealer
database that circulates as a sold download
([fitment-data-sourcing.md](./fitment-data-sourcing.md)). Separately, both
vendors use the **same BMW model id**, `8c6b7373fb3d59dc8aa3185a3f570460`
(which is `md5("bmw:1")`), and the same image file name `models/bmw/1.jpg` [P,
compared in this session]. That suggests a shared upstream data source or
engine. Neither vendor says where the data comes from.

## 2. Delivery and what the API returns

**ACAT** [P] [Swagger, acat.online/api2](https://acat.online/api2): REST v2,
`Authorization` header key, API tariff only. Endpoints: `/catalogs` (types and
makes), `/catalogs/models`, `/catalogs/modifications`, `/catalogs/groups`,
`/catalogs/parts`, `/catalogs/scheme` (image), `/catalogs/search` (VIN, frame,
make, model), `/catalogs/searchParts2`, plus `/partners/followers` for reseller
sub-accounts. `/catalogs/parts` returns the group, prev/next group, image URL,
`labels[]` (number, name, box coordinates on the image) and `numbers[]`
(`number`, `name`, `description`, `labelId`, `groupId`). **No quantity or
date-range field** in the schema. Also a widget ("30 minutes") or a subdomain,
and plugins for ABCP, PartsSoft, Zaptrade, Docpart.

**Parts-Catalogs** [P] [docs](https://docs.parts-catalogs.ru/docs): REST at
`https://api.parts-catalogs.com/v1/`, `Authorization` key, IP allowlist, no
separate test environment. Endpoints documented: `catalogs/`,
`catalogs/{id}/models/`, `car/info?q=`, `cars/vin-validator`,
`catalogs/{id}/cars2/`, `cars-parameters/`, `groups-tree`, `groups-suggest`,
`parts2`. `parts2` returns the diagram, `partGroups`, `parts` and `positions`
(coordinates); the BMW example shows `11422469721` "Oil filter", "QTY: 1",
"Old part number", "Reconditioned part number", weight [P]. Text search is not
available in truck and Chinese catalogues. The HTML widget is keyed by a "TWS
key" bound to our domain, sends `{article}` and `{brand}` to a back-URL template
of ours, and calls **our** price endpoint (`data-price-url`, params `code`,
`brand`, 30 s timeout) to show prices and a cart button.

## 3. Pricing, billing, who contracts, can we pay

| Item              | ACAT                                                                                                                                                                                                     | Parts-Catalogs                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit              | Requests per month, VIN searches capped separately [P]                                                                                                                                                   | "1 request is a search of parts for 1 car, which is valid 24 hours and provides info about 200 parts" [P]                                                                                                                                                                  |
| Tiers             | Cars+moto widget 4,990 RUB/mo (20,000 req incl. 2,000 VIN); trucks same; full catalogue from 7,990 RUB; **API from 19,990 RUB/mo** (100,000 req incl. 10,000 VIN) [P] [rates](https://acat.online/rates) | EU page: EUR 229 (1,000), 649 (3,000), 839 (5,000), 1,299 (10,000) per month [P] [eu](https://www.parts-catalogs.com/eu). tradesoft.pro: USD 279 / 799 / 999 / 1,599, then 2,199 (20,000) and 7,999 (100,000), "exclusive of local taxes" [P]. RU: 7,590 to 52,590 RUB [P] |
| Discounts / trial | Up to 30% for 3+ months prepaid; free trial [P]                                                                                                                                                          | Free 2-day demo [P]. Unused requests do not roll over (RU offer 4.2) [P]                                                                                                                                                                                                   |
| Payment           | Invoice, SBP, Visa/MasterCard/Mir, SberPay, YuMoney, QIWI; RUB only [P]                                                                                                                                  | Tradesoft Global: "bank card ... processed by ... Stripe", or bank transfer against invoice; non-refundable, cancel at period end (Terms 6.4, 7.1, 7.2) [P]                                                                                                                |
| Contracting party | ООО «Компания АвтоДилер», INN 6662127289, Yekaterinburg; Russian law, Sverdlovsk arbitration court (offer 1.1, 13.2, 13.4) [P]                                                                           | RU: ООО «Компания «ТрэйдСофт», INN 4345057975, Kirov (offer) [P]; the .ru footer names ООО «ТС-ПЛЮС» with the **same INN and OGRN** [P]. International: **Tradesoft Global LLC**, Wyoming, Wyoming law, ICDR arbitration (Terms 22) [P]                                    |
| Bank on record    | Bank Tochka [P], on the US SDN list since 12 Jun 2024 and in the EU package of 24 Feb 2025 [S] [t-j.ru](https://t-j.ru/news/sanctions-banks/)                                                            | RU offer: Sberbank [P], EU-designated since 2022 [S] [Latham](https://www.lw.com/admin/upload/SiteAttachments/Sanctions-Update-EU-Designates-Sberbank-and-Further-Enhances-Sanctions-Against-Russia.pdf). Tradesoft Global's bank **[NOT ESTABLISHED]**                    |

**Is parts-catalogs.ru the same company as parts-catalogs.com?** Same product,
same API host and docs (docs.parts-catalogs.ru brands itself
"docs.parts-catalogs.com"), and the EU page says "Tradesoft has specifically
developed Parts-Catalogs" [P]. tradesoft.pro's footer and contact page put
Tradesoft Global LLC at a Sheridan, WY registered-agent address with an
Estonian phone and a UAE WhatsApp, "working hours GMT+4" [P]; tradesoft.eu.com's
footer gives "Tradesoft Global LLC, p/b 9, Kirov, Russia, 610000" [P], the same
PO box as the Russian ООО in its offer. So: one group, two legal entities.
Which entity invoices the EUR prices on parts-catalogs.com/eu is **[NOT
ESTABLISHED]**; parts-catalogs.eu did not resolve.

**Can a Serbian company pay?** ACAT: practically no route found; rouble
invoices, Russian payment rails, a sanctioned bank. Serbia has not adopted EU
sanctions, but whether the owner's Serbian bank will send money to Bank Tochka
or Sberbank is **[NOT ESTABLISHED]** and I would not try. Parts-Catalogs via
Tradesoft Global LLC: card through Stripe is a normal route; its own Terms 21
make the customer warrant it is not in a comprehensively US-sanctioned country,
which Serbia is not [P].

## 4. Licence terms that matter

**ACAT** (public offer at [acat.online/rules](https://acat.online/rules), all
[P]). It is AutoDealer's generic software licence, not written for catalogue
data:

- 1.2: the products are licensed "without the possibility of exporting
  information to third-party software".
- 5.2.3 no copying to any media; 5.2.6 no distribution, including "any
  publicly accessible placement of the Software (in whole or in part)";
  5.2.8 no derived works; 5.2.12 no "automated collection of information and its
  systematisation using scripts, bots"; **5.2.13 no exporting Program data to
  third-party software**.
- 6.1: all rights, "including databases", belong to the licensor. No word on
  where the OEM data comes from or any manufacturer licence.
- Payments non-refundable (9.5); liability capped at fees paid (12.8).
- Nothing on caching duration, attribution, or AI.
- Telling detail: ACAT's own robots.txt **disallows** its public BMW and
  Mercedes catalogue pages (`Disallow: /catalogs/CARS_FOREIGN/bmw`) [P]. The
  vendor itself keeps this content out of search engines.

**Parts-Catalogs, Russian offer** ([PDF](https://www.tradesoft.ru/documents/contracts/%D0%94%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%20%D0%BF%D1%83%D0%B1%D0%BB%D0%B8%D1%87%D0%BD%D0%BE%D0%B9%20%D0%BE%D1%84%D0%B5%D1%80%D1%82%D1%8B%20Parts.Catalogs.pdf),
all [P]):

- 1.4 and 1.5: "Users" are people using the catalogue **on the licensee's
  site**; a request is a User's lookup by VIN or make/model. Showing results to
  shop visitors is the licensed use.
- 6.3 API keys may not reach third parties; 8.8 fine of three times the tariff.
- **6.5: "Transfer of data by the Licensee to third parties" is treated as
  infringement of exclusive IP rights.**
- **10.2: HTML access requires a visible hyperlink to parts-catalogs.ru**,
  which may not be removed or hidden (attribution).
- 8.2: the licensor "is not responsible for the content of the catalogues".
- One-year term, auto-renewing, one month's notice (7.4 to 7.6); Russian law,
  Kirov arbitration court (9.3, 10.1).

**Parts-Catalogs, international Terms** ([tradesoft.pro/terms](https://www.tradesoft.pro/terms/),
updated 2026-10-12, all [P]):

- 4.3: licence "solely for your internal business purposes and for operating
  your own online store".
- 9.1: data "compiled from vehicle manufacturers, parts manufacturers,
  suppliers and other third-party sources"; no accuracy guarantee for catalog
  data, cross references or VIN decoding. 9.2: fitment checks are on us.
- **12.1: no "extract, scrape, download in bulk or systematically harvest
  catalog data, or use catalogs ... to build a competing database or product"**;
  no making the Services available to third parties except our End Users.
- 13.1: "Tradesoft and its licensors own" the catalogs and databases.
- No clause on cache duration, indexable pages, attribution, or AI was found.

**Data provenance and disputes.** Neither vendor states a licence from BMW
Group or Mercedes-Benz. I found no public takedown or lawsuit naming either
vendor **[NOT ESTABLISHED]**; BMW's ETK is copyrighted and was never sold to the
public [S] [bimmerfest](https://www.bimmerfest.com/threads/legal-purchase-use-of-elektronikteilkatalog-etk-tis-epc-htk-etm-ksd.90857/).
The risk of a rights claim sits with whoever republishes, and the vendor's
liability is capped at fees.

## 5. Fit with our architecture

| Use                                                                                       | ACAT                                                                                                                | Parts-Catalogs                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **(a) Staff lookup tool** (manager decodes a VIN, reads the OEM number, quotes a price)   | **Allowed** (use "by direct functional purpose", 2.3) but payment route blocked                                     | **Allowed** (4.3 internal business purposes). Cheapest fit: 1,000 cars a month is far above staff need                                                                                                                                                 |
| **(b) Live VIN to diagram on carlab.rs, noindex, OEM number to Inter Cars lookup**        | **Unclear to forbidden**: widget for shop sites is the product, but 5.2.13 forbids exporting data to other software | **Allowed in design**: the widget is built to send `article` and `brand` to our search and price endpoints [P]. Caching beyond the 24-hour request window **unclear**. Mandatory backlink under the RU offer (10.2); EU contract **[NOT ESTABLISHED]** |
| **(c) Source for our stored catalogue** (Parts, PartIdentifiers, Fitments, ADR-0039/0041) | **Forbidden** (5.2.3, 5.2.12, 5.2.13)                                                                               | **Forbidden** in bulk (12.1). Storing the single OEM number a customer put in a cart, as an order record: **unclear**, ask. Copying positions or fitments into Fitment rows: forbidden                                                                 |
| Public indexable pages from their data                                                    | Forbidden (5.2.6)                                                                                                   | Not granted; 6.5 (RU) treats transfer to third parties as infringement                                                                                                                                                                                 |

Notes on (b) against our current design: ADR-0039 says "no licensed feed", so
(b) needs a new ADR. Our VIN chain (ADR-0040) stays the indexable path; the
vendor view would be an extra, noindex "show me the diagram" step after our own
VinLookup. Parts-Catalogs numbers are BMW's `11422469721` format; our
PartIdentifier `oem` values carry spaces (`11 42 8575211`), so the join needs
normalisation. Inter Cars API access (#328) is still the blocker for any price.

## 6. Comparison and recommendation

| Criterion                          | ACAT                                | Parts-Catalogs                               |
| ---------------------------------- | ----------------------------------- | -------------------------------------------- |
| OEM diagrams + positions + numbers | Yes [P]                             | Yes, plus quantity and old-number fields [P] |
| Aftermarket cross references       | No                                  | No (only what our price server returns)      |
| BMW + Mercedes VIN                 | Yes [P]; depth unknown              | Yes [P]; depth unknown                       |
| Serbian / English                  | No / yes                            | No (on request) / yes                        |
| Widget / REST                      | Yes / yes (API tier)                | Yes / yes                                    |
| Entry price                        | 4,990 RUB widget, 19,990 RUB API    | EUR 229 or USD 279 per 1,000 cars            |
| Contracting party for us           | Russian ООО only                    | Tradesoft Global LLC (US) or Russian ООО     |
| Payable from Serbia                | Doubtful (RUB, sanctioned bank [S]) | Yes by card via Stripe [P]                   |
| Fills our own catalogue            | Forbidden                           | Forbidden                                    |
| Data provenance disclosed          | No                                  | No; `bmw_2020_01` image path is a hint       |

**Recommendation.**

1. **Do not buy ACAT.** Payment, governing law and 5.2.13 rule it out before
   data quality matters.
2. **Parts-Catalogs is worth the free 2-day demo, nothing more yet.** Ask for
   it through Tradesoft Global LLC (support@tradesoft.pro), not the Russian
   ООО. Test with VINs already in our research:
   `WBA35BG070N074158`, `WBA53FJ04RCR27526` (BMW), `WDD2050041R316333`,
   `W1K3G1CB9PJ403934` (Mercedes, incl. a 2023+ VIN our rules cannot
   resolve). Check that it returns type code, production date, SA codes /
   Baumuster, and that B47/B48/OM654 oil-filter numbers match what the
   workshop actually fits.
3. **If the demo and the written answers are good, buy the 1,000-request
   tier** (EUR 229 / USD 279 a month, monthly, no annual prepay) for use (a)
   first. Add (b) only with a new ADR and only behind noindex. Never use it
   for (c); the staff-maintained catalogue of ADR-0039 stays ours.
4. **If the answers are evasive, stay where ADR-0039 is**: VIN inquiry form,
   staff checking numbers by hand, our own data for SEO.

### Questions to put to Tradesoft in writing before paying

1. Which legal entity invoices a Serbian company for parts-catalogs.com, in
   which currency, from which bank and country? Is the Russian offer or the
   tradesoft.pro Terms the governing contract?
2. Does Tradesoft hold a licence from BMW Group and Mercedes-Benz (or a
   licensed distributor) to redistribute their EPC data to third-party shops?
   From whom, and may we see a confirmation? Will Tradesoft indemnify us
   against a rights holder's claim?
3. Is the EU 49-brand package's Mercedes-Benz catalogue included, and is the
   BMW data newer than `bmw_2020_01` (G-series coverage)?
4. Does `car/info` return BMW type code, production date and SA option codes,
   and Mercedes Baumuster plus code list? Can we filter parts by them?
5. May we show results on public pages, and must those pages be noindex?
6. How long may we cache API responses (diagrams, numbers) beyond the 24-hour
   request? May we store an OEM number in our database when a customer adds it
   to a cart or orders it, and keep it in order history after termination?
7. May we send OEM numbers from the API to Inter Cars' API to fetch prices
   and stock?
8. Is the parts-catalogs.ru backlink (RU offer 10.2) required under the
   international contract, and for API use as well as HTML?
9. Is any use with AI or machine-learning tools restricted?
10. Can a Serbian (or English) UI be added, at what price?
