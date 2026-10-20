# Filling the parts catalogue without typing every row

Research date: **2026-10-20**. Question from the owner: the staff-maintained
catalogue of [ADR-0039](../adr/0039-own-catalogue-data-staff-maintained-vehicles.md),
[ADR-0040](../adr/0040-one-catalog-module-vehicle-reference-tables.md) and
[ADR-0041](../adr/0041-part-attributes-requirements-supersession.md) (Vehicles per
BMW type code or Mercedes Baumuster, Parts with PartIdentifiers, Fitments,
Category fields, Requirements; terms in [GLOSSARY.md](../../GLOSSARY.md)) looks
unrealistic to fill by hand. Can AI, a ready-made database, or both fill it,
legally and reliably? Scope: carlab.rs, BMW N47/B47/B48 and Mercedes
OM651/OM654, maintenance consumables first, prerendered SEO pages.

Not legal advice. Every point marked **lawyer** needs a Serbian IP lawyer
before it becomes a plan.

## Source status

- **[P]** primary source read in this session: the vendor's or legislator's own
  page or document.
- **[S]** secondary: a search-engine snippet, a third-party page, or a
  primary page that would not render.
- **[NOT ESTABLISHED]** could not be verified.

## The one-paragraph answer

Partly, and not the way "just ask an AI" suggests. **No legal ready-made
database covers us**: everything complete (TecDoc) comes with terms ADR-0039
already rejected, including a ban on using the data with AI (GTC 1.6.6) and a
duty to delete it all on termination (GTC 1.12). **An LLM must not be the
source** of part numbers or fitments: no published evaluation shows it can
produce them reliably, and a wrong cross reference is a wrong part in a
customer's engine. What does work is **AI as a clerk over documents we
legitimately hold**: Inter Cars product data, supplier invoices, our own
workshop history, the owner's manuals and the makers' public oil approval lists.
The model extracts candidate rows into a staging table with a zod schema and a
source link per row, staff approve or delete them in a review queue, and only
approved rows reach the catalogue. Requirements (oil approval, capacity) are the
easiest win: a few dozen facts per engine family from public manufacturer
documents. Fitments and OE cross references stay the slow part; the best legal
accelerator is our own service history (what we actually fitted to which car),
then written permission from a brand or distributor for its data. Model cost is
small (tens to low hundreds of USD for a few thousand Parts); staff review time
is the real cost.

## 1. AI-assisted filling

### 1.1 Can an LLM produce fitment and cross references from its own knowledge or the web?

- **No published evaluation of LLM accuracy on OEM part numbers or
  OEM-to-aftermarket cross references was found** [NOT ESTABLISHED]. General
  hallucination benchmarks report that models do worst exactly where an exact
  number is required, e.g. the DefAn benchmark notes significant hallucination
  "when numeric values were required" [S]
  ([arXiv 2406.09155](https://arxiv.org/pdf/2406.09155)). A part number is the
  extreme case: a plausible string one character off (`HU 816 x` vs `HU 816 z`)
  is a different filter.
- With web search the model reads whatever ranks: marketplace listings,
  scraped TecDoc mirrors, forums. That makes it a **scraper with extra steps**:
  the provenance is unknown, and if the page was a TecDoc copy, our row is a
  copy of a protected database (section 1.4).
- Supersessions and date splits (production-date ranges, steering, gearbox) are
  where catalogues differ and where an LLM has least to go on.

**Conclusion:** unreviewed generation is out. Generation as a _hint_ for staff
(the model proposes, cites the URL, staff verify against a source we may use)
is acceptable but saves little, because the verification is the work.

### 1.2 The pattern that is safe: extractor, not author

1. **Input is a document we hold legitimately**: a supplier invoice or delivery
   note, an Inter Cars product record or CSV, a brand price list sent to us, an
   owner's manual page, a manufacturer's approved-oils sheet, an AutoTEK work
   order export.
2. **Output is a zod-validated candidate row** (`z.object({...}).strict()`, as
   the repo already does for content), one per Part, PartIdentifier, Fitment or
   Requirement, with `source` (document id, page, quoted span), `extractedBy`
   (model + version) and a model-reported `confidence`.
3. **Deterministic checks before a human sees it**: normalised number format
   per brand, the number must occur verbatim in the quoted span, the Category
   field and option keys must exist (the attributes module of ADR-0041), the
   Vehicle must exist.
4. **Mandatory human review**: staff approve, edit or delete in the admin.
   Only approved rows enter the `catalog` module. Confidence only sorts the
   queue; it never skips review.
5. **The LLM is never the source of truth.** The source column always names a
   document, never "AI".

### 1.3 Cost

Official prices read on 2026-10-20 [P]:

| Provider  | Model        | Input / output per 1M tokens    | Batch | Web search                         |
| --------- | ------------ | ------------------------------- | ----- | ---------------------------------- |
| Anthropic | Haiku 5.5    | USD 0.10 / 0.50 (prompts ≤100K) | -50%  | USD 10 per 1,000 searches + tokens |
| Anthropic | Sonnet 5.5   | USD 2 / 10                      | -50%  | same                               |
| OpenAI    | GPT-5.4-Mini | USD 0.75 / 4.50                 | -50%  | USD 10 per 1,000 calls + tokens    |
| OpenAI    | GPT-6.1-Sol  | USD 2 / 10                      | -50%  | same                               |

Sources: [claude.com/pricing](https://claude.com/pricing),
[OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

**Estimate (mine, assumptions stated):** 3,000 Parts, three source documents
each, about 3,000 input and 1,000 output tokens per extraction call: 27M input
and 9M output tokens. Sonnet-class: about USD 144, or about USD 72 in batch.
Haiku-class: about USD 7. A web-search "hint" pass at five searches per Part
adds about USD 150 in search fees plus the tokens of every page read, which
dominate and are not predictable. Either way the model bill is far below one
week of staff time.

### 1.4 Legal frame: facts vs databases

- **Facts are free; a database's substance is not.** The EU sui generis right
  protects a maker who made "a substantial investment in either the obtaining,
  verification or presentation of the contents" against "extraction and/or
  re-utilization of the whole or of a substantial part" (Directive 96/9/EC
  Art. 7(1)) [P]
  ([Art. 7](https://www.legislation.gov.uk/eudr/1996/9/article/7)). Repeated
  and systematic extraction of insubstantial parts is caught too (Art. 7(5))
  [P]. That is exactly what a bot or a person copying a catalogue row by row
  does.
- The CJEU limited it to investment in obtaining and verifying existing data,
  not in creating it (C-203/02 _British Horseracing Board_) [S]
  ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62002CJ0203)).
  Whether a brand's fitment data counts as "created" or "obtained" is a
  **lawyer** question; assume protected.
- **Serbia mirrors it.** Zakon o autorskom i srodnim pravima ("Sl. glasnik RS"
  104/2009 ... 66/2019) [P]
  ([paragraf.rs](https://www.paragraf.rs/propisi/zakon_o_autorskom_i_srodnim_pravima.html)):
  Art. 137 defines the database maker by "značajno ulaganje ... u
  pribavljanje, proveru ili predstavljanje sadržaja", Art. 138 gives the right
  to forbid "izdvajanje, odnosno ponovno iskorišćavanje ukupnog ili značajnog
  dela", Art. 140b lets a lawful user take insubstantial parts, Art. 147 sets
  15 years. A new copyright law was in public consultation in March-April 2026
  [S]; adoption [NOT ESTABLISHED].
- **Contract beats the default rule.** Where we obtained data under terms
  (TecDoc GTC, a brand portal, AOS), the terms decide, even for facts.
- **Practical reading:** a single fact taken from an owner's manual or an
  invoice and entered in our own words is low risk. Systematically lifting a
  brand's catalogue, a TecDoc screen or a competitor's site into ours is the
  risk, whether a human or an LLM does the copying.

## 2. Ready-made data we may import and store

### 2.1 Aftermarket brands

| Brand                 | What is offered publicly                                                                                                                                                                              | Bulk / reseller data                                                                                                                                                                                                                                                                        | Terms on reuse                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mann-Filter           | Free interactive PDF catalogues (cars and transporters 2024-2026), a cross reference list PDF, part-number explanation [P] ([download hub](https://www.mann-filter.com/en/service/download-hub.html)) | Data distributed through TecDoc ("Premier Data Supplier") [S]; no dealer data file found [NOT ESTABLISHED]                                                                                                                                                                                  | No terms on the download hub [P]; legal notice not found [NOT ESTABLISHED]                                                                                                                                                                   |
| Mahle                 | Online catalogue on TecDoc [S]                                                                                                                                                                        | **TecCMD**: "as a wholesaler you can obtain the latest product information free of charge", stock, prices and "material master data" by browser or SFTP, for "MAHLE customers" [P] ([TecCMD](https://www.mahle-aftermarket.com/eu/en/services/teccmd/)); vehicle applications not mentioned | Aftermarket T&C exist as a PDF, not read [NOT ESTABLISHED]                                                                                                                                                                                   |
| Bosch                 | Catalogue via TecDoc, "Premier Data Supplier" [S]                                                                                                                                                     | No direct feed found [NOT ESTABLISHED]                                                                                                                                                                                                                                                      | [NOT ESTABLISHED]                                                                                                                                                                                                                            |
| Febi (bilstein group) | partsfinder for febi, SWAG, Blue Print behind a free registration with GTC [S]                                                                                                                        | [NOT ESTABLISHED]                                                                                                                                                                                                                                                                           | GTC page did not render [NOT ESTABLISHED] ([GTC](https://partsfinder.bilsteingroup.com/en/general-terms-conditions))                                                                                                                         |
| Hengst                | Online catalogue with cross reference and vehicle search, downloadable product catalogues and data sheets [S] ([catalog](https://catalog.hengst.com/en/online-catalog/search/))                       | [NOT ESTABLISHED]                                                                                                                                                                                                                                                                           | [NOT ESTABLISHED]                                                                                                                                                                                                                            |
| Meyle                 | Online catalogue [S]                                                                                                                                                                                  | Data goes to "various partners and catalogs": TecDoc, Autocat/MAM, ACES/PIES via PDM; no direct download [P] ([data management](https://www.meyle.com/en/quality/data-management))                                                                                                          | [NOT ESTABLISHED]                                                                                                                                                                                                                            |
| NGK (Niterra)         | Part Finder online [S]                                                                                                                                                                                | [NOT ESTABLISHED]                                                                                                                                                                                                                                                                           | Reproduction "only permitted if they are reproduced in their entirety and without any changes"; quotations allowed with source [P] ([T&C](https://www.ngkntk.com/website-terms-conditions/)). Bars reshaping their catalogue into our pages. |

**Pattern:** every premium brand pushes its structured data through TecDoc (and
TecCom), not to small resellers directly. Their free PDFs are fine as a **staff
lookup aid** for single facts; bulk-importing a PDF catalogue is an extraction
of their database and needs **written permission**. Brands want their parts
sold, so asking through the distributor's brand manager is worth one email per
brand [S, inference].

### 2.2 Inter Cars

Covered in [intercars-ecat-api.md](./intercars-ecat-api.md) and
[fitment-data-sourcing.md](./fitment-data-sourcing.md#3-inter-cars). Nothing new
found: the IC API's `catalog/products` carries the IC SKU, index, brand, EAN,
TecDoc id, a free-text description (sometimes "pasuje do: ..." vehicle lists)
and supports `sr`; it carries no structured vehicle applicability or OE
cross references [P]. Value for us: **Part names, brand numbers, EANs and
descriptions for items we buy from them**, which we may display because we
resell them [NOT ESTABLISHED in writing; ask in #328]. The free-text "fits"
list is a candidate source for the extractor, but it is TecDoc-derived, so
**lawyer** plus Inter Cars confirmation before publishing anything extracted
from it.

### 2.3 Other distributors in Serbia

- **Automaterijal** offers a partner API: up to 100 items per request by catalog
  number and brand, returning stock and net RSD price; no applicability or OE
  data mentioned [P]
  ([poslovna integracija](https://automaterijal.com/poslovna-integracija)).
- KIT Commerce, Gazela and others run B2B webshops [S]; no data feed with
  fitment found [NOT ESTABLISHED]. As in the earlier research, regional players
  are TecDoc consumers, not alternatives.

### 2.4 TecDoc Data Package

- Bulk "structured set of text and binary files" over SFTP, weekly, for
  distributors and e-commerce; country, region and language subsets; includes
  "vehicle linkages" [P]
  ([Data Package](https://www.tecalliance.net/products/cards/data-packages)).
  Scoping by brand or article group is not stated on the page; earlier research
  shows brand count drives price [NOT ESTABLISHED for the Data Package].
- **Termination, confirmed in GTC v3.2 (status 01.04.2026) clause 1.12** [P]:
  "the Customer must immediately and completely cease use of the database,
  delete all copies present on its systems, and delete any backup copies".
  Data from a licence cannot be kept afterwards, so every Fitment that came
  from it would vanish.
- **GTC 1.6.6** [P]: use "in the context of artificial intelligence" and
  training of machine learning models is prohibited. Running TecDoc data through
  an LLM pipeline needs written consent.
- **Catalogue seat** (the cheap workshop UI): data "may not be reproduced
  and/or made publicly available without the consent of TecAlliance"
  (2.7.2.5) [P]. **Staff reading TecDoc in a seat (or in AutoTEK's TecDoc
  module) and typing it into our public pages is a contract breach**, not a
  workaround.

### 2.5 Open and public data

- **No open fitment dataset for European cars was found.** VehiclesDB is
  CC-BY 4.0 but has makes and models only, no chassis, engine, type code or
  parts [P] ([vehiclesdb](https://github.com/vehiclesdb/vehiclesdb)). A Kaggle
  "Auto Parts Dataset" is CC BY-NC 4.0 [S], non-commercial, so unusable.
  Wikidata has no parts fitment model [NOT ESTABLISHED in depth].
- **Mercedes oil approvals** are published by Mercedes on
  [operatingfluids.mercedes-benz.com](https://operatingfluids.mercedes-benz.com/sheet/229.51)
  (BeVo moved there on 2021-12-01 [P]); the sheet lists approved products per
  spec (229.51, 229.52 ...) [S, JS-only page]. Download format and reuse terms
  [NOT ESTABLISHED]. Which spec and capacity each engine needs is stated in the
  owner's manual and in sheet 223.x [NOT ESTABLISHED which sheet].
- **BMW Longlife lists** (LL-01, LL-04, LL-17FE+) circulate as BMW PDFs on
  document sites [S]; no current official download found [NOT ESTABLISHED].
  BMW's AOS (free ETK, EEA domicile caveat) is covered in
  [fitment-data-sourcing.md](./fitment-data-sourcing.md#oem-catalogue-etk-style-data).
- **Owner's manuals** state oil spec and capacity per engine. These are single
  facts; entering "B47: LL-04, x.x l" from the manual is the cleanest
  Requirement source there is. The oil brands' own product sheets state which
  approvals each oil holds, which fills the oil Category fields.

### 2.6 Our own data: workshop history

The service is the shop's best data source. Every job records a car (VIN, so
type code or Baumuster), the parts fitted (brand number, often OE number) and
the date. That is **observed fitment**: the part physically went on that
Vehicle. It is our own record, so no third-party database right applies to the
facts we generate ourselves [S, inference; **lawyer** to confirm for part
numbers that AutoTEK pulled from its TecDoc module].

- AutoTEK has no documented export; ask Regos (questions already listed in
  [autotek-api-integration.md](./autotek-api-integration.md#questions-for-the-vendor)).
- Supplier e-invoices (SEF and Inter Cars invoices) carry brand numbers and
  EANs for everything we bought, also ours to use [S].
- Fallback without export: printouts or PDFs of work orders through the
  extractor.

## 3. Pipeline for a small team

| Table (ADR-0040/0041)                    | Feed                                                                   | Automation                                              |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Make / Series / Chassis / Model / Engine | Staff, once (a few dozen rows)                                         | None needed                                             |
| Vehicle + VehicleIdentifier              | VinLookup misses, workshop VINs decoded by our own rules (ADR-0040)    | Auto-propose from VINs; staff name the Model and Engine |
| Part + PartIdentifier                    | Inter Cars products, invoices, brand price lists                       | Extractor; dedupe on normalised `(type, brand, value)`  |
| Fitment                                  | Workshop history first; brand PDFs one fact at a time; staff knowledge | Extractor from work orders; staff approve each          |
| Category field values                    | Brand product sheets, Inter Cars description, oil data sheets          | Extractor against the Category's field definitions      |
| Requirement                              | Owner's manuals, Mercedes operating-fluid sheets, BMW LL lists         | Staff, assisted; a few rows per Engine family           |
| Supersession                             | Invoices showing a replaced number, supplier notices                   | Staff only                                              |

**Mechanics** (all within existing ADRs):

- **Staging**: one table of candidate rows (JSON payload validated by the same
  zod/attributes module), or plain CSV/JSON files imported by a Medusa script.
  No new module needed for a pilot.
- **Dedupe**: normalise numbers before matching (strip spaces, dots, dashes,
  case; keep brand in the key, as the glossary demands). A candidate whose
  normalised identifier exists attaches to that Part instead of creating one.
- **Provenance**: ADR-0041 records who and when. A staging row adds `source`
  (document, page, quote) and `extractedBy`. Keeping `source` on the approved
  row too is a small schema addition worth an ADR amendment, so a disputed
  Fitment can be traced and deleted with all its siblings from the same source.
- **Review queue**: an admin list of pending candidates with the source quote
  beside the proposed row; approve, edit, delete. Bulk approve only per source
  document, never across sources.
- **Manual for good**: Supersession, "confirm your variant" notes, date and
  gearbox splits, and anything a source states ambiguously.

### Effort estimate for the pilot

Target: top 200 Parts for BMW N47/B47/B48 and Mercedes OM651/OM654. All numbers
below are **my estimates, not measurements**; time the first 20 rows and redo
the sum.

- Reference tables and Requirements: a day or two of staff time (oil, coolant,
  brake fluid per engine family from manuals and fluid sheets).
- 200 Parts with 3 to 6 identifiers each: with extraction from invoices and
  Inter Cars data, review at roughly 1 to 2 minutes per Part, so under a day;
  by hand, several days.
- Fitments: the unknown is the number of Vehicles (type codes and Baumuster
  per engine family), which I could not establish. Consumables attach per
  Engine family through bulk attach, so the work scales with distinct
  Part-to-family decisions (hundreds), not with Part x Vehicle pairs. Expect
  one to two staff-weeks including verification, less if workshop history
  arrives.
- Build: staging table, extractor script, review screen: roughly a week of
  development for the minimal version.

## 4. Comparison

| Route                                             | Legality                                               | Reliability                        | Cost                                           | Effort                     |
| ------------------------------------------------- | ------------------------------------------------------ | ---------------------------------- | ---------------------------------------------- | -------------------------- |
| Own workshop history (AutoTEK, invoices)          | High (our records) [lawyer on TecDoc-origin numbers]   | Highest: observed fitment          | Regos export fee unknown                       | Medium                     |
| Owner's manuals, MB fluid sheets for Requirements | High for single facts                                  | High                               | None                                           | Low                        |
| LLM extractor over held documents + review        | High if inputs are ours                                | High after review                  | USD 10s to 100s                                | Medium (build + review)    |
| Inter Cars product data                           | Likely, confirm in writing (#328)                      | High for names/numbers, no fitment | Free API, integration cost                     | Medium                     |
| Brand data with written permission                | High once granted                                      | High                               | Unknown                                        | Low per brand, slow to get |
| TecDoc Data Package                               | High while licensed, deleted on termination, no AI use | Highest coverage                   | Above ADR-0039 estimate                        | High                       |
| LLM generating numbers/fitments from the web      | Unclear provenance, likely copies protected data       | Unknown, no evaluation exists      | Low                                            | Low, then costly errors    |
| Scraping catalogues, TecDoc screens, dumps        | **No**                                                 | Unknown                            | Penalty exposure (GTC 1.11.2: from EUR 10,000) | n/a                        |

## 5. Recommendation

Ranked by legality first, then reliability, cost and effort:

1. **Requirements from manufacturer documents, by staff now.** Oil approval and
   capacity per Engine family from owner's manuals and Mercedes operating-fluid
   sheets; oil Category fields from the oil makers' own data sheets. Smallest
   effort, unlocks universal Parts (oils) on every Vehicle at once.
2. **Our own workshop history as the Fitment seed.** Send Regos the export
   questions; meanwhile run supplier invoices and work orders through the
   extractor. Fitments that came off our own lift are the most reliable rows we
   will ever have.
3. **The LLM extractor + review queue** over documents we hold (Inter Cars
   records, invoices, price lists, manuals). zod schema, verbatim-span check,
   source on every row, nothing published unreviewed. Haiku- or mini-class
   models are enough; batch API halves the cost.
4. **Ask for permission, in writing**: Inter Cars (may we display and store
   product data and the "pasuje do" text?), and the brand managers of Mann,
   Mahle (TecCMD access through our distributor), Febi, Hengst, Meyle, NGK for
   a data file covering BMW/MB consumables. Each yes turns a PDF lookup aid
   into an importable source.
5. **TecDoc stays deferred** per ADR-0039; if bought later, plan for deletion
   on termination (1.12) and for its AI ban (1.6.6), so it cannot feed this
   pipeline without consent.

**Do not:**

- Publish any LLM-generated part number, cross reference or Fitment that a
  person has not checked against a source we may use.
- Scrape brand catalogues, Autodoc-style shops, partsfinder or TecDoc mirrors,
  or let an LLM with browsing do it for us.
- Buy or use leaked TecDoc or EPC dumps, or "TecDoc alternative" APIs of
  unknown licence ([tecdoc-licence-pricing.md](./tecdoc-licence-pricing.md#grey-and-unlicensed-sources-do-not-use)).
- Copy from a TecDoc Catalogue seat, AutoTEK's TecDoc module or BMW AOS into
  public pages row by row; repeated insubstantial copying is still extraction
  (Directive Art. 7(5), Serbian Art. 140b).
- Bulk-import the bimmerarchive mirror (ADR-0039, [vin-decode-cheap-alternatives.md](./vin-decode-cheap-alternatives.md)); no Mercedes equivalent exists.

**Lawyer questions:** whether part numbers recorded in our AutoTEK history but
looked up through its TecDoc module are ours to publish; whether a brand's own
cross reference list PDF may be imported without a licence; what the 2026 draft
copyright law changes for databases if adopted.
