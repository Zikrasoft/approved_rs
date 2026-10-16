# Where fitment data for a BMW VIN parts shop comes from

Research date: **2026-10-16**. Question from the owner: carlab.rs wants a real
VIN-based parts shop modelled on germsp.ru's BMW ETK pages (VIN decodes to
model and engine, exploded-diagram schemas with numbered positions, each an OEM
number with production-date ranges, variant codes such as gearbox or steering
side, and "see equivalents" links to aftermarket brands). The hardest part is
the data: which parts fit which car, and which aftermarket numbers are
equivalent to which OEM number. Paid licensing is on the table. Pilot scope:
BMW, roughly 2.0 L engines.

## Source status

Same tags as the other files in `docs/research/`:

- **[P]** primary source read directly in this session: a vendor's own page,
  price list, API documentation or the text of a regulation.
- **[S]** secondary: a third-party integrator's or reseller's page, a forum
  answer, a news item, or a search-engine snippet of a page that would not
  render (JS-only or Cloudflare-blocked).
- **[NOT ESTABLISHED]** could not be verified from any available source.

## The one-paragraph answer

There are two different data products here, and the germsp.ru experience needs
both. **OEM catalogue data** (the BMW ETK: diagrams, positions, OEM numbers,
date ranges, variant codes) comes only from BMW itself or from vendors that
redistribute EPC data; TecDoc does not have it in that shape. **Aftermarket
fitment and cross-reference data** (which Bosch/Mann/Febi article fits this
car, which OEM number it replaces) is what TecDoc is, and nothing else in
Europe is a real substitute for it. Inter Cars' API carries neither: it is a
stock, price and ordering API keyed on Inter Cars SKUs with a TecDoc id for
mapping. ACES/PIES is a North American standard and is the wrong tool for a
European BMW pilot.

## 1. TecDoc / TecAlliance

### What it contains

- Article data from aftermarket brands ("Data Suppliers"), organised by
  Generic Article group, linked to vehicles by **KType** (a TecDoc vehicle id:
  brand, model, type, years), with **OE numbers as cross-references** that make
  OEM to aftermarket lookups possible in both directions.
  [S] [PartWiz, "TecDoc Explained"](https://www.partwiz.app/blog/tecdoc-explained);
  [S] [Dev Opla, "What is TecDoc"](https://dev-opla.com/resources/what-is-tecdoc-auto-parts-ecommerce-guide)
  ("Over 10 million parts linked to 110,000+ vehicle models", "Cross-references
  between OE numbers and aftermarket equivalents").
- Search by "article number, OE number, brand, vehicle, VIN, or VRM" through the
  TecDoc Web Service, aimed at distributors and e-commerce/marketplaces.
  [P] [TecAlliance, TecDoc Web Service](https://www.tecalliance.net/products/cards/tecdoc-web-service)
- **Production-date and variant criteria exist, on the linkage.** The TecDoc
  Data Format specifies construction year as `YYYYMM` and date-type criteria in
  `yyyymm`; steering side is coded as `L`/`R`; data suppliers can request new
  criteria. [S, search snippet of]
  [TecDoc Data Format 2.6 (PDF)](https://www.tec-doc-services.com/download/TecDoc-Data-Format_Version_2.6_EN.pdf)
  and [TecAlliance download copy](https://dwnld.aws.tecalliance.com/TecDoc/Downloads/TecDoc-Data-Format.pdf).
  I could not open the PDF in this session to quote the criteria list itself.
- **Known weakness: granularity.** A KType is "defined fitment", so for
  gearbox-, alternator- or steering-dependent parts a KType search often returns
  several candidates, and a VIN or plate lookup does not help because it is
  converted to a KType first. [S] [Joan Cabós, "Limitations of the TecDoc ktype"](https://www.linkedin.com/pulse/limitations-tecdoc-ktype-joan-cab%C3%B3s)
- **What it is not:** an OEM exploded-diagram catalogue. TecDoc's structure is
  generic article groups per vehicle, filled by aftermarket brands; parts no
  aftermarket brand makes (most BMW body, trim and small hardware) have no
  article to link to. That TecDoc gives "replacement parts catalogs" rather than
  the original catalogue is also how Russian practitioners describe it.
  [S] [Habr Q&A 823643](https://qna.habr.com/q/823643). "OE to aftermarket
  cross-references are not perfect. Sometimes equivalents are missing."
  [S] [Dev Opla guide](https://dev-opla.com/resources/what-is-tecdoc-auto-parts-ecommerce-guide).
  TecAlliance does sell a separate "TecDoc OE Parts Data" product, derived from
  "analysis of OE spare parts catalogues (EPCs)", but its own page aims it at
  parts manufacturers (coverage analytics, replacement mapping) and does not
  mention diagrams, positions or date ranges.
  [P] [TecAlliance, TecDoc OE Parts Data](https://www.tecalliance.net/products/cards/oe-parts-data)

### Cost

- **No public price for the data/API licence.** TecAlliance's own product pages
  carry none. [P] [TecDoc Web Service page](https://www.tecalliance.net/products/cards/tecdoc-web-service)
- The model integrators report: "a percentage of shop turnover against an
  annual minimum, with the data package layered on top: article groups, vehicle
  types, languages included, and refresh frequency." [S]
  [Dev Opla, TecDoc e-commerce](https://dev-opla.com/solutions/auto-parts-ecommerce-tecdoc-integration).
  Neither the percentage nor the minimum is published anywhere I could find
  **[NOT ESTABLISHED]**.
- Data points that exist, none of them a webshop data licence:
  - TecAlliance's own shop sells the *TecDoc Catalogue* end-user app (Classic,
    Garage Data, Garage Data Pro) on 12-month terms with a 14-day card trial;
    the price is only shown after login. This is a workshop lookup tool, not a
    data feed for a shop. [P] [TecAlliance shop, Garage Data](https://shop.tecalliance.net/tecdoc-catalogue-garage-data/5637251097.p)
  - A Hungarian reseller lists a TecDoc web catalogue single-user licence at
    EUR 164 net/year. [S] [WTS Magyarország](http://tecdoc.wtsmagyarorszag.hu/order) (search snippet)
  - UK: Optiseller, in partnership with TecAlliance, offered a modular licence
    at GBP 600/year covering the first 5,000 products' data (2019), explicitly
    because small retailers otherwise had to buy the whole catalogue.
    [S] [ChannelX, 2019](https://channelx.world/2019/12/optiseller-give-cost-effective-tecdoc-catalogue-access-for-auto-parts-traders/)
  - "Anywhere from a few thousand to tens of thousands of euros in the first
    year" including build and maintenance. [S] search snippet attributed to
    [Mecaparts blog](https://www.mecaparts.app/blog/integrating-tecdoc-with-your-online-store);
    the fetched page had the figures removed, so treat as anecdotal.

### Access and lead time for a Serbian reseller

- Licences come from TecAlliance directly or through authorised partners. [S]
  [Dev Opla](https://dev-opla.com/resources/what-is-tecdoc-auto-parts-ecommerce-guide)
- **The Balkan partner is in Belgrade:** QUANTUM-AutoMARKET, TecAlliance's first
  TAPP partner in the Balkans, reselling for Serbia, Bosnia and Herzegovina,
  Montenegro, North Macedonia and Albania. Contact `office@automarket.rs`,
  +381 11 2310 145; no prices on the site. [P]
  [automarket.rs, TAPP article](https://www.automarket.rs/en/DocumentArchive/Article/7);
  [S] [Motormagasinet announcement](https://www.motormagasinet.se/announcement/view/628852/quantumautomarket_brings_great_ideas_to_life_as_tecalliance_partner)
- No published company-size requirement **[NOT ESTABLISHED]**. Lead time for the
  licence itself is not published **[NOT ESTABLISHED]**; one integrator quotes
  3 to 6 months for a full TecDoc + TecCom shop build, which is build time, not
  licence time. [S] [Dev Opla](https://dev-opla.com/solutions/auto-parts-ecommerce-tecdoc-integration)

## 2. Alternative vendors

### OEM-catalogue (ETK-style) data

| Vendor | What | Price | Source |
| --- | --- | --- | --- |
| **BMW AOS** (BMW's own Aftersales Online System) | Official ETK for independent operators. "Registration, use of the electronic parts catalog and the digital service booklet are free of charge." Repair info ticket from EUR 5/hour to EUR 850/year. | Parts catalogue free | [P] [AOS price list 01.02.2024 (PDF, mirrored on partnerzy-bmw.pl)](https://partnerzy-bmw.pl/file-download/MjE3) |
| **Parts-Catalogs** (parts-catalogs.com) | OEM catalogues for 49 brands incl. BMW, VIN search, HTML widget or REST API, monthly updates. "1 request is a search of parts for 1 car, which is valid 24 hours and provides info about 200 parts." | EUR 229/mo (1,000 req) to EUR 1,299/mo (10,000 req); 2-day free demo | [P] [parts-catalogs.com/eu](https://www.parts-catalogs.com/eu) |
| **Laximo** (Russia) | Laximo.OEM original catalogues with VIN identification and applicability; widely embedded by Russian shop platforms (ABCP, Parts-Soft, Docpart). | Not published on laximo.ru; one plugin vendor references a separately bought Laximo.OEM licence | [S] [Parts-Soft](https://parts-soft.ru/categories/vozmozhnosti-sistemy/originalnye-katalogi-laximo.html), [S] [Webasyst plugin](https://www.webasyst.ru/store/plugin/shop/laximo/) |
| **partslink24** | Multi-brand OE catalogue (BMW included) for workshops, ordering from dealers. | Search snippet: USD 23/mo yearly, 35/mo monthly, 12/day. Primary page is JS-only. | [S] [partslink24 subscription](https://www.partslink24.com/portal-ui/subscription-menu/subscription) |

Notes on each:

- **BMW AOS is the legal, official source of ETK data, but not a data feed.** It
  is a portal for humans. The EU type-approval regulation obliges makers to give
  independent operators RMI "in the form of machine-readable and electronically
  processable datasets" (Reg. (EU) 2018/858 Art. 61), and the CJEU in C-319/22
  read that as files suitable for direct electronic processing, not a
  searchable database API. [S, search snippets of]
  [Reg. 2018/858 consolidated](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R0858-20240701)
  and [C-319/22 summary](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62022CA0319).
  **Two caveats for carlab.rs:** AOS licences are for "independent operators"
  as defined by EU regulations, and a search snippet of the AOS conditions says
  domicile in the EEA/Switzerland (or a comparable regime) is required; Serbia
  is neither. [S] [AOS conditions of use](https://aos.bmwgroup.com/conditions-of-use)
  (JS-only page, not readable here). Whether AOS terms permit republishing
  ETK content on a public shop is **[NOT ESTABLISHED]**; I would assume not.
- **Parts-Catalogs** is the only vendor found with a public, reseller-sized
  price and an API made for embedding in a shop. Its legal entity and where its
  OEM data comes from are not stated on the page **[NOT ESTABLISHED]**. Before
  paying, get in writing that they hold redistribution rights for BMW data.
- **Laximo** is the de-facto supplier behind many Russian OEM catalogue sites.
  Billing in roubles from a Russian company is a practical (sanctions/payment)
  problem for a Serbian business; I did not verify whether they sell outside
  Russia **[NOT ESTABLISHED]**. The Habr answers also mention Epcdata (Asian
  brands) and ABCP's "Original catalogues" add-on at 3,000 RUB/30 days. [S]
  [Habr Q&A 823643](https://qna.habr.com/q/823643)
- **partslink24** is a workshop lookup and ordering tool; nothing found
  suggests it licenses data for third-party shops.

### Aftermarket fitment data, cheaper or nearer than TecAlliance direct

- **QUANTUM-AutoMARKET** (Belgrade, above) is the local route into TecDoc
  itself, and the cheapest one to ask first.
- **AUTODOC**: no data-licensing offer for resellers found. Its B2B arms are a
  marketplace (selling *through* AUTODOC) and AUTODOC PRO for garages. A RapidAPI
  listing "Autodoc Parts Catalog" exists; I could not confirm it is operated by
  AUTODOC. [S] [AUTODOC FAQ](https://autodoc.group/en/faq/),
  [RapidAPI listing](https://rapidapi.com/autodoc/api/autodoc-parts-catalog)
- **"TecDoc alternative" APIs on Apify/RapidAPI** (e.g. an Apify "Auto Parts
  Catalog - Tecdoc API alternative" actor, now 404) are scraper resales of
  someone else's data. TecDoc use requires a TecAlliance licence, so these are
  grey market and unsafe to build a shop on. [S]
  [Apify listing (search result)](https://apify.com/making-data-meaningful/tecdoc)
- No Balkan or CEE aggregator selling its own independent fitment database
  turned up. Regional players (Inter Cars, Quantum) are TecDoc users or
  resellers, not alternatives to it.

## 3. Inter Cars

**Inter Cars' API does not carry fitment or OE cross-reference data.** Read in
full from their own docs: [P]
[IC API reference](https://docs.webapi.intercars.eu/ic-api/en/contracts/api)
(linked as "Technical documentation" from
[Inter Cars API & CSV, client page](https://intercars.com/en/business-solutions-inter-cars/business-services/software/api-and-csv-client-inter-cars)).

- Endpoints: `inventory/stock`, `inventory/quote`, `catalog/category`,
  `catalog/products`, `delivery`, `invoice`, `sales/requisition` and
  `sales/order`, `pricing/quote`, `customer`, `customer/finances`. Nothing for
  vehicles, VIN, applicability, KType or OE numbers (keyword scan of the page:
  `vehicle` 0, `vin` 0, `oem` 0, `cross` 0, `ktype` 0, `tecdoc` 1).
- `catalog/products` filters by Inter Cars sales category, SKU, index or brand,
  and supports `sr` among its languages.
- The only fitment trace is a free-text `description` such as "Filtr oleju
  pasuje do: CHRYSLER LE BARON, VIPER, FIAT 125 ..." which is a human string,
  not structured data.
- The one TecDoc hook: "Mapping between IC SKU and other product codes (like -
  EANs, Index, TecdocID etc.) are available and has been provided as Inter Cars
  product catalog." So Inter Cars gives you the **join key** from its SKU to a
  TecDoc article, not the TecDoc linkage itself. Search snippets of the
  employee-facing page describe the same ProductInformation fields (towkod,
  index, TecDoc identifier, manufacturer, description, EAN, size). [S]
  [Inter Cars API & CSV, employee page](https://intercars.com/en/business-solutions-inter-cars/business-services/software/api-and-csv-employee-inter-cars)
- Access: through your Inter Cars sales representative; daily CSV feeds of
  stock, prices and product descriptions are also offered. [P] client page above.
  "The use of the API is free, but the customer will have to bear the cost of
  the implementation." [S] search snippet of the same page.
- Inter Cars Serbia (Inter Cars d.o.o.) is described as a top-3 wholesaler at
  about EUR 40-45 m revenue, mostly B2B. [S]
  [Aftermarket substack, Serbia 2025](https://aftermarket.substack.com/p/serbia-automotive-aftermarket-2025)
- Inter Cars' own *e-catalog* for workshops does vehicle lookup, almost
  certainly on TecDoc, but it is a UI for their customers, not licensed data you
  can republish **[NOT ESTABLISHED beyond the product page title]**.
  [S] [Inter Cars e-Catalog](https://intercars.com/en/business-solutions-inter-cars/offer-for-workshop/e-catalog)

Consequence: Inter Cars is the **supply and price** side; it does not remove
the need for a fitment licence. Its TecDoc ids make a TecDoc licence cheaper to
use, because stock maps onto TecDoc articles without matching by hand.

## 4. ACES / PIES

- **ACES** (Aftermarket Catalog Exchange Standard) standardises fitment: a part
  linked to a vehicle described by Auto Care reference databases (VCdb vehicles,
  PCdb part types, Qdb qualifiers). **PIES** standardises product attributes,
  prices, packaging and assets. To create or receive ACES files "one must
  subscribe to one of the VCdb packages." [P]
  [Auto Care, Data Standards subscriptions](https://www.autocare.org/data-standards/subscriptions);
  [P] [ACES](https://www.autocare.org/aces), [P] [PIES](https://www.autocare.org/data-standards/product-information-exchange-standard-(pies))
- **Cost of the reference data, not of any fitment data:** Light Duty VCdb is
  tiered by revenue, from USD 3,150 member / 4,410 non-member (under USD 1 m)
  to USD 8,625 / 12,075 (over USD 10 bn); an all-in Entry Level Package is
  USD 2,500/year for members under USD 1 m revenue. [P] same subscriptions page.
- **Coverage:** VCdb Light Duty lists "Regions Vehicle Types Sold In: United
  States, Canada, and Mexico". [P] same page. European-market BMW variants
  (European engine codes, LHD/RHD Euro trims) are outside that scope.
- **No open or low-cost ACES fitment datasets exist that I found.** What you
  license from Auto Care is the vocabulary; the fitment rows themselves come
  from each brand's own ACES files, shared with its customers.
- In Europe the equivalent is TecDoc; the two vehicle id systems "do not map
  directly to each other". [S]
  [Start With Data, ACES and PIES explained](https://startwithdata.co.uk/insight/aces-pies-explained-automotive-distributors/)

Verdict: not adaptable to this pilot at any useful cost. Skip.

## 5. How germsp.ru-style ETK sites are actually built

### germsp.ru itself (inspected in this session)

- Footer: "© Академия BMW. 2009-2026"; sections "Разделы ЕТК", "ETK онлайн",
  "AIR-отчеты". Moscow wholesale of BMW, MINI and Rolls-Royce parts. [P]
  [germsp.ru](https://germsp.ru/), [germsp.ru/etk/catalog](https://germsp.ru/etk/catalog)
- The catalogue pages load no third-party catalogue widget or script (only
  Yandex Metrica, GTM and an icon host). Diagram images come from
  `academy-etk.online/images/<id>_t.jpg`, a host that answers its root with a
  JSON `403 "Доступ запрещен"` from an nginx/Node API. [P] read with `curl`.
  So the catalogue is **self-hosted on their own backend**, not an embedded
  Laximo/Parts-Catalogs frame.
- **Where the data came from is not disclosed.** The plausible routes are an
  official BMW Group Russia arrangement (some Russian ETK sites claim one, e.g.
  [epc-system.ru](https://epc-system.ru/info/bmw/bmw.html), unreadable here)
  or an import of the offline dealer ETK database, which has circulated for
  years as a sold "ETK 01/2020"-style download.
  [S] [autocatalogues.com, BMW ETK 01-2020](https://www.autocatalogues.com/catalogues/bmw.htm),
  [S] [autocd.by](https://autocd.by/autosoft/legkovye_avtozapchasti1/bmw_etk_17/).
  Which one germsp.ru used is **[NOT ESTABLISHED]**.

### The general pattern (Russian practitioner sources)

- Shop platforms do not own catalogue data. ABCP, Parts-Soft and Docpart all
  plug in **Laximo** (OEM) and **TecDoc** (aftermarket) as separate paid
  services; "the cost of the catalog is determined by the rights holder and is
  paid directly to the catalog supplier", platform support on top from
  1,500 RUB/month. [S] [Parts-Soft, Laximo](https://parts-soft.ru/categories/vozmozhnosti-sistemy/originalnye-katalogi-laximo.html),
  [S] [ABCP blog, Laximo](https://www.abcp.ru/blog/Katalogi-Laximo-dlya-internet-magazinov-avtozapchastey),
  [S] [Docpart, catalogues](https://docpart.ru/vozmozhnosti-platformy-docpart/katalogi-podbora-avtozapchastej)
- Practitioners on Habr say outright that parsing makers' catalogues is
  sometimes done "despite licensing concerns" for lack of official API access,
  and that nobody has a universally reliable source. [S]
  [Habr Q&A 823643](https://qna.habr.com/q/823643)
- Honest reading: the "OEM diagram + aftermarket equivalents" sites are two
  licences glued together (an EPC data vendor plus TecDoc via OE-number
  cross-references), and a share of the market runs on leaked dealer EPC dumps
  or scraped portals. I found no public write-up from a site of this kind that
  names a legal BMW ETK data licence.

## Comparison

| Source | Coverage | Cost | Access lead time | BMW ~2.0 L pilot fit |
| --- | --- | --- | --- | --- |
| **TecDoc** (via QUANTUM-AutoMARKET, Belgrade, or TecAlliance) | Aftermarket articles from 1,000+ brands, KType linkage with date and variant criteria, OE-number cross-refs both ways. No OEM diagrams, no OEM-only parts. [P][S] | Not published. Reported as % of turnover vs annual minimum [S]; small modular deals have existed (GBP 600/yr UK) [S] | Unpublished; partner sale, then integration (3 to 6 months for a full shop build, [S]) | **High** for service parts on N20/B48/B47/N47 cars (filters, brakes, suspension, belts, ignition): exactly what an independent shop sells. Weak on gearbox/steering-dependent parts (KType granularity). |
| **BMW AOS** | Official ETK, complete OEM data, VIN, diagrams. [P] | Parts catalogue free [P] | Self-registration; EEA/CH domicile likely required [S] | Perfect data, unusable as a feed: portal only, redistribution rights unknown, Serbian company may not qualify. Useful for staff verification. |
| **Parts-Catalogs** | 49 brands incl. BMW, OEM diagrams via VIN, REST API or HTML widget [P] | EUR 229-1,299/mo by requests [P] | "Within an hour" for the widget; 2-day demo [P] | **High** for the ETK half of germsp.ru. Data provenance and redistribution rights unverified. |
| **Laximo** | OEM catalogues with VIN and applicability, used by most Russian shop platforms [S] | Not published | Russian vendor, rouble billing | Technically fits; commercially awkward from Serbia. Second choice to Parts-Catalogs. |
| **partslink24** | Multi-brand OE lookup and dealer ordering [S] | ~USD 23-35/mo per user [S] | Online signup | Staff tool only, no shop feed. |
| **Inter Cars API** | Stock, price, ordering, SKU to TecDoc id. No fitment, no OE cross-refs. [P] | API free, integration on you [S] | Through the sales rep [P] | **Supply side only.** Needed for prices and stock, does not replace fitment data. |
| **ACES/PIES** | North American vehicles (US/CA/MX) [P] | USD 2,500-12,075/yr for reference DBs, no fitment rows [P] | Immediate subscription | **None.** Wrong market. |
| Scraped/"TecDoc alternative" APIs, leaked ETK dumps | Varies | Cheap | Immediate | Do not build on it: licence and takedown risk on the shop's core asset. |

## Recommendation for the BMW 2.0 L pilot

1. **Email QUANTUM-AutoMARKET first** (`office@automarket.rs`) for a TecDoc Web
   Service quote scoped narrowly: BMW (and MINI if wanted) passenger cars,
   the service-part article groups the shop will actually stock, Serbian and
   English, monthly refresh. Ask for the annual minimum, the turnover
   percentage, whether a reseller of their size qualifies, and whether brand or
   article-group scoping lowers the price (the Optiseller precedent says it can).
   This is the backbone: it answers "which parts fit this car" and "what are the
   equivalents" for the parts that make the money, and Inter Cars' TecDoc ids
   plug straight into it.
2. **In parallel, run the Parts-Catalogs 2-day demo** on a few real BMW VINs
   with B47/B48/N47/N20 engines, and ask them in writing (a) which legal
   entity contracts, (b) whether they hold rights to show BMW diagrams on a
   public shop. If yes, the 1,000-request tier (EUR 229/mo) covers a pilot and
   gives the germsp.ru-style diagram view. If they cannot answer (b), do not
   ship BMW diagrams publicly.
3. **Wire Inter Cars as the price and stock source only**, through the sales
   rep, joined to TecDoc on the TecDoc id.
4. **Register on BMW AOS** if the domicile check allows it, purely for staff to
   double-check OEM numbers on difficult orders. Do not scrape it.
5. **Skip ACES/PIES**, and skip any "TecDoc alternative" scraper API.

If the TecDoc quote comes back too high for a pilot, the fallback is to drop
the self-serve fitment layer and keep the current VIN-inquiry form
(`project_vin_parts_inquiry_mvp`), with staff using Parts-Catalogs or AOS by
hand. That keeps the pilot honest without buying a licence before demand is
proven.

### Open questions to put to the vendors

- TecDoc: annual minimum and turnover share for a Serbian start-up; is there a
  brand-scoped or article-group-scoped package; licence lead time.
- Parts-Catalogs: contracting entity and country; BMW redistribution rights;
  whether their API exposes production-date ranges and variant codes per
  position (the demo will show it).
- BMW AOS: whether a Serbian-domiciled company can register as an independent
  operator, and whether parts data may be republished.
