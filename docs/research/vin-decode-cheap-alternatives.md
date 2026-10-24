# Cheap VIN decoding for European BMWs

Research date: **2026-10-20**. Follow-up to
[`vin-decode-options.md`](https://github.com/Zikrasoft/approved_rs/blob/83a061a7/docs/research/vin-decode-options.md)
(commit `83a061a7`, not in the working tree), which covered NHTSA vPIC, the
ISO 3779 libraries, Vincario, carVertical, autoDNA and VehicleDatabases. This
note does not repeat it. Question: is there anything free, under about EUR 30 a
month, or cents per lookup that turns a European BMW VIN (example
`WBA35BG070N074158`, type key = characters 4-7 = `35BG`) into chassis, model,
engine code, body, production date and ideally steering, gearbox and SA option
codes, for a small Serbian parts shop piloting N47/B47/B48 cars?

## Answer

No paid API found meets the budget **and** provably returns a BMW engine code
for a European VIN. The cheapest legitimate API with EU coverage on paper is
auto.dev (1,000 free calls a month), but its own docs say a VIN whose first
character is not `1`-`5` gets a partial, unbilled `207` answer with reason
`market_not_covered`, so a German BMW VIN most likely stops at make/model/year.
Vincario's real rate card, read from its own price endpoint, starts at **EUR 49
a month for 100 lookups (EUR 0.49 each)**, above the budget. The sites that do
return SA codes for BMW (dec.vin, mdecoder, bimmer.work, bimmer.studio,
RealOEM) have no API, and three of them block their decode paths in
`robots.txt`, so automating any of them is scraping and is not usable. The best fit for the pilot remains **our own
type-key table**: the VIN's characters 4-7 already resolve an F-series BMW to
chassis, model, body, engine code, kW, drivetrain and steering side, and an
MIT-coded open mirror of that mapping exists to seed the pilot rows from, with
caveats below (no G20/G21, no production dates on F-series rows, unresolved EU
database right).

## Source status

Same tags as the other notes in this folder:

- **[P]** primary source read in this session: a vendor page, API response or
  repository file on its own domain.
- **[S]** secondary: a search-engine summary or a reseller page about someone
  else's product.
- **[NOT ESTABLISHED]** could not be verified from any available source.

No vendor account was created, so no paid or keyed endpoint was called.

## 1. Vincario: the real rate card

The pricing page renders its table client-side. The page's own Ziggy route list
names `js-api/pricing/get-prices/api-services`, and that public endpoint returns
the tiers as JSON (currency `EUR`) **[P]**:

| Product        | Lookups/month | Price/month | Per lookup |
| -------------- | ------------- | ----------- | ---------- |
| API VIN Decode | 3 (free)      | EUR 0       | free       |
| API VIN Decode | 100           | EUR 49      | EUR 0.49   |
| API VIN Decode | 500           | EUR 149     | EUR 0.298  |
| API VIN Decode | 1,000         | EUR 249     | EUR 0.249  |
| API VIN Decode | 5,000         | EUR 1,099   | EUR 0.22   |
| API VIN Decode | 10k-1M        | on request  | on request |

The same page's FAQ says **[P]**: limits are monthly, annual billing is not
available, the minimum contract is one month, "Invalid or unrecognized VINs are
not charged", and above the quota you either pause or stay "Always Active" with
overage "billed at the same per-lookup price". Whether the EUR prices include
VAT is **[NOT ESTABLISHED]**. Source:
[vincario.com/pricing](https://vincario.com/pricing/).

This corrects the earlier note: the USD 49.99 / 99.99 / 199.99 / 499.99 tiers it
quoted belong to Zyla Labs' "Europe VIN Decoder API" listing (section 2), not to
Vincario. Whether Vincario's `decode` returns a BMW engine code such as
`B47D20` rather than a generic engine description is **[NOT ESTABLISHED]**: its
API docs list the actions (VIN Decode Info, VIN Decode, OEM VIN Lookup, Get
Balance, Enums) but no BMW-specific field **[P]**
([vincario.com/api-docs](https://vincario.com/api-docs/)). The 3 free lookups a
month are enough to check that on two or three pilot VINs before paying.

## 2. Marketplaces (RapidAPI / Zyla)

- **Zyla "Europe VIN Decoder API"** **[P]**: USD 49.99/500, 99.99/2,000,
  199.99/7,000, 499.99/15,000, 999.99/50,000 requests a month; overage USD
  0.1299740 a request; 7-day trial with 50 requests. Its sample decodes a VW
  Passat (`WVWZZZ3BZWE689725`) to make, model, model year, "Trim level", body
  style, vehicle class, engine, fuel type. No BMW sample and no engine-code
  field shown. Underlying data provider not disclosed.
  ([zylalabs.com/.../europe+vin+decoder+api/888](https://zylalabs.com/api-marketplace/data/europe+vin+decoder+api/888))
- **Zyla "BMW VIN Decoder API"** **[P]**: USD 24.99 for 500 requests, then
  49.99/2,000 up to 999.99/100,000; overage USD 0.0649740. This is the only
  listing under the budget, but its documented endpoints return WMI-level
  fields (`manufacturer`, `country`, `region`, `wmi`, `vds`, `vis`, `year`,
  `model`, `class`) plus glass part data, and its sample VIN
  `WBA53FJ04RCR27526` is a North-American-format VIN (check digit, year `R`).
  No evidence it decodes a European type key to an engine code
  **[NOT ESTABLISHED]**.
  ([zylalabs.com/.../bmw+vin+decoder+api/3250](https://zylalabs.com/api-marketplace/automotive+%26+vehicle+data/bmw+vin+decoder+api/3250))
- **RapidAPI listings** (`vin-decoder-api-europe` by Zyla, `vin-decoder7`,
  `dealerkit/vin-decoder`) render client-side and could not be read. Search
  summaries quote free Basic tiers and USD 49-199 paid tiers **[S]**; EU BMW
  depth unverified.

## 3. US-first APIs with an EU claim

- **auto.dev** **[P]**: Free plan, USD 0, **1,000 API calls a month**, no card,
  "Global VIN Decode" included. Growth USD 299/month plus USD 0.0025 per
  decode. Docs: the decoder consults "the EU decoder" for non-North-American
  VINs, and a VIN "built outside North America (first character not `1` to
  `5`)" returns `207 Multi-Status` with reason `market_not_covered`, which "is
  not a billed call". The 207 body carries `make`, `model`, `year`,
  `manufacturer`, `type`. Live call without a key returns `401`
  ("Authentication required"), so the actual answer for `WBA35BG070N074158`
  is **[NOT ESTABLISHED]**; the docs point to make/model at best, no engine
  code. ([auto.dev/pricing](https://www.auto.dev/pricing),
  [docs.auto.dev/v2/products/vin-decode](https://docs.auto.dev/v2/products/vin-decode))
- **CarAPI** **[P]**: USD 199-299 a year, but "VIN decoding for vehicles sold in
  the United States: 1990 - 2027". Not usable.
  ([carapi.app/pricing](https://carapi.app/pricing))
- **DataOne**: page states coverage depends on market, prices only by quote;
  EU coverage **[NOT ESTABLISHED]**.
- **VinAudit, Vindecoderz**: pages returned 404/403 to this session; EU BMW
  coverage and pricing **[NOT ESTABLISHED]**.
- **vPIC re-check** **[P]**: the example VIN returns `Make: BMW`, empty model,
  and "Unused position(s): 4,5,6,7", confirming the earlier note: the type key
  is exactly what NHTSA does not decode for EU BMWs.

## 4. BMW-specific decoder sites

All of these are manual web tools. None publishes an API. Automating any of
them without written permission is scraping and **not usable**.

| Site                                              | What it shows for BMW                                                                 | Price                                     | Automation status                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [dec.vin](https://dec.vin/)                       | Series, type, steering, engine code, production date, I-level, full FA/SA option list | 2 free VINs/day, USD 3 per 5 more **[P]** | No API; `robots.txt` disallows `/api/` **[P]**                                                               |
| [mdecoder.com](https://www.mdecoder.com/)         | Options, paint, upholstery                                                            | Free, donations **[P]**                   | No API; `robots.txt` disallows `/decode/` **[P]**                                                            |
| [bimmer.work](https://bimmer.work/)               | Options list, configurator images                                                     | Not stated                                | No API; `robots.txt` disallows `/query.php` **[P]**                                                          |
| [bimmer.studio](https://bimmer.studio/vin-decode) | Series, engine, body, gearbox, drive, XEP equipment                                   | Free, account for extras                  | No API found **[P]**; terms **[NOT ESTABLISHED]**                                                            |
| RealOEM                                           | VIN to ETK model, parts diagrams                                                      | Free                                      | Terms page 403; `robots.txt` sets `Content-Signal: use=reference` and blocks AI crawlers **[P]**. Not usable |
| etsinfo / bimmercat                               | Not reached                                                                           | **[NOT ESTABLISHED]**                     | No API found **[NOT ESTABLISHED]**                                                                           |

A person on staff typing a customer's VIN into dec.vin by hand is a different
thing from an integration, and is the cheapest way to get SA codes for a single
order. Whether its terms allow commercial use is **[NOT ESTABLISHED]**.

## 5. Open type-key data

- **`alisacorporation/bimmerarchive-open-data`** (GitHub, created 2026-09-18)
  **[P]**: a mirror of the defunct bimmerarchive.org, rebuilt from Wayback
  Machine snapshots into JSON and CSV. 4,339 production type keys across 285
  chassis codes, each row `code, chassis, model, body, engine, power_kw,
drivetrain, steering, region, from, to`. Code is MIT; `DATA.md` claims the
  rows are uncopyrightable facts, says "Use it freely", but explicitly leaves
  open whether the EU _sui generis_ database right (Directive 96/9/EC) of the
  original compilers applies. GitHub reports the licence as `NOASSERTION`.
- **Checked against the pilot** (download of `data/production-codes.csv`,
  4,339 rows) **[P]**:
  - F30 is covered: e.g. `3D31` = F30 320d Sedan, N47D20O1, 135 kW, RWD, left
    hand drive, Europe; `8C51` = F30 LCI 320d, B47D20O0, 140 kW. N47 appears
    in 363 rows, B47 in 145; F30/F31/F34 rows exist for both.
  - **No G20/G21 rows at all**, and only a few G-series chassis (G11/G12, G30,
    G08 and some others). `35BG` from the example VIN is **not in the
    dataset**; what it decodes to is **[NOT ESTABLISHED]**.
  - `from`/`to` are blank on 1,230 of 1,300 F-series rows, so no production
    date window for the cars that matter.
  - Gearbox and SA options are not in the data at all.
- **`jakkuh/bmw-vin-decoder`** **[P]**: MIT, but its BMW part is hand-coded
  series/plant heuristics on top of vPIC; option codes are listed as "requires
  proprietary database access". Nothing to seed from.
- **`zapscript/bmw-etk-parts-database-sql`** **[P]**: sells an ETK SQL dump and
  states it is "not licensed OEM software". Not a legitimate source.
- Wikipedia chassis articles list engine codes per model name but not VIN type
  keys **[S]**.

## Comparison

| Option                              | Price                                   | BMW EU fields (proven)                                                       | Terms                                    |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| Own type-key table                  | EUR 0                                   | Chassis, model, body, engine code, kW, drive, steering, region               | Ours; seed provenance caveat below       |
| auto.dev Free                       | USD 0, 1,000 calls/mo                   | Likely make/model/year only (`207 market_not_covered`), engine code unproven | Self-serve API                           |
| Zyla BMW VIN Decoder                | USD 24.99 / 500                         | WMI-level, sample is a US VIN                                                | Reseller, provider undisclosed           |
| Vincario                            | 3 free/mo, then EUR 49 / 100 (EUR 0.49) | Generic spec; BMW engine code unproven                                       | Self-serve API, monthly                  |
| Zyla Europe VIN Decoder             | USD 49.99 / 500                         | Make, model, trim, body, engine, fuel (VW sample)                            | Reseller, provider undisclosed           |
| dec.vin by hand                     | 2 free/day, USD 3 / 5                   | Everything incl. SA codes and production date                                | Manual only; no API                      |
| mdecoder, bimmer.work, RealOEM etc. | Free                                    | Options, paint                                                               | No API, decode paths blocked: not usable |

## Recommendation

1. **Pilot on our own type-key table.** Characters 4-7 of a European BMW VIN
   are the type key, and one key resolves to one chassis/model/body/engine/
   steering combination. A pilot limited to N47/B47/B48 cars is a few dozen
   rows, small enough to maintain by hand, needs no vendor and costs nothing
   per lookup. It does not give production date, gearbox or SA codes; nothing
   under budget does.
2. **Seed only the pilot rows, and verify each one.** Take the F30/F31/F34
   (and F20/F45/F48 if wanted) N47/B47/B48 rows from the bimmerarchive mirror,
   not the whole 4,339-row file, which keeps us well away from "substantial
   extraction" under the EU database right. Check each row against a second
   source (a real customer VIN through Vincario's 3 free monthly lookups, or a
   manual dec.vin lookup) before it goes live. This is not legal advice; if the
   table grows past the pilot, ask a lawyer.
3. **G20/G21 and other G-series need another source.** The mirror has no G20
   rows and the example `35BG` key is unresolved. Fill those rows from real
   customer VINs as they arrive (decoded by hand by staff), and let an unknown
   key fall through to the existing lead form so a person answers it.
4. **Spend money only if the table proves too thin.** Before paying, use
   Vincario's 3 free lookups to see whether its `decode` returns a BMW engine
   code for an EU VIN. If it does, EUR 49 a month for 100 lookups is the
   cheapest proven-EU paid path; if it does not, no paid generic decoder adds
   anything over the table, and the next step is the parts-catalogue route the
   earlier note already flagged.
