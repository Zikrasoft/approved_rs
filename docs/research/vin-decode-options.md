# VIN-decode service options for the carlab.rs BMW parts pilot

GitHub issue #325 (part of map issue #320). Question: what VIN-decode
mechanism should carlab.rs use to build a germsp.ru-style BMW ETK pilot
(roughly 2-litre engines first)? germsp.ru turns a VIN into model / engine /
trim / production date plus spec facts such as paint code, interior trim and
fluid-fill volumes. No vendor is chosen yet. The owner wants free/open-source
options surfaced first, paid only if the free tier cannot do the job.

This note only covers VIN decoding itself. Parts fitment (TecDoc-style) is
flagged at the end but is being researched in depth in a sibling ticket.

## 1. Free/public decoders: NHTSA vPIC

NHTSA's Product Information Catalog and Vehicle Listing (vPIC) API
(https://vpic.nhtsa.dot.gov/api/) is free, no key required, rate-limited only
by an automated traffic-control mechanism. Its own docs page states it is
built from data "submitted by the Motor Vehicle manufacturers" under 49 CFR
Part 565 and offers `DecodeVin`, `DecodeVinValues` (flat JSON/XML/CSV),
`DecodeWMI`, `GetAllMakes`, `GetAllManufacturers` and more. Source:
[vpic.nhtsa.dot.gov/api](https://vpic.nhtsa.dot.gov/api/).

**This is a US-registration system first.** The docs don't say "US VINs only",
but the regulatory basis (49 CFR 565, the NHTSA check-digit/model-year
character rules) is the North American VIN standard, not the global ISO 3779
baseline every manufacturer otherwise follows.

**Live test against a European BMW VIN.** `WBAVA31070NL12345` (WBA = BMW,
Germany; a representative F30-series 320d-pattern VIN, not independently
verified against a real title/registration) was sent to the live endpoint:

```
curl "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/WBAVA31070NL12345?format=json"
```

Result (fields trimmed to the relevant ones):

```json
{
  "Make": "BMW",
  "Manufacturer": "BMW AG",
  "Model": "",
  "ModelYear": "",
  "Series": "",
  "Trim": "",
  "BodyClass": "",
  "EngineCylinders": "",
  "DisplacementL": "",
  "FuelTypePrimary": "",
  "PlantCountry": "SOUTH AFRICA",
  "PlantCity": "ROSSLYN",
  "VehicleType": "PASSENGER CAR",
  "ErrorCode": "1,11,14,400",
  "ErrorText": "1 - Check Digit (9th position) does not calculate properly; 11 - Incorrect Model Year - Position 10 does not match valid model year codes (I, O, Q, U, Z, 0). Decoded data may not be accurate.; 14 - Unable to provide information for some of the characters in the VIN, based on the manufacturer submission.; 400 - Invalid Characters Present"
}
```

So vPIC resolved the WMI (`WBA` -> BMW AG, Germany) and even the plant code
(Rosslyn, South Africa, a real BMW 3-Series RHD-market plant), but every
spec field that actually matters for a parts catalogue (model, model year,
engine displacement/cylinders, body class, trim) came back empty, and the API
flagged the VIN with four error codes: the North-American check-digit formula
(position 9) failed, the model-year character (position 10) didn't match
NHTSA's accepted set, and it admits it "is unable to provide information for
some of the characters... based on the manufacturer submission." This is the
expected, structural failure mode for a European VIN, not a one-off bad test
case: European manufacturers are not required to follow the NHTSA check-digit
algorithm or model-year letter table, and vPIC's decode table is built only
from what manufacturers submit to NHTSA for the US market, so it has nothing
to decode a German-market-only trim/engine combination against even when the
VIN passes validation. Conclusion: vPIC is not viable as the primary decoder
for carlab.rs's BMW pilot; it may still be useful as a free cross-check for
US-market/US-title vehicles only.

## 2. Open-source WMI/VIN-standard (ISO 3779/3780) libraries

Several maintained libraries exist on npm and PyPI. All of them confirm the
expectation stated in the brief: WMI-level identification (manufacturer,
country/region, assembly plant where encoded) plus ISO 3779 structural
validation (check digit, VDS/VIS parsing), not vehicle-spec decoding.

- **`vininfo`** (PyPI), the most-used Python option. Its own README examples
  return `Country`, `Manufacturer`, `Region`, `Years` (candidate model years
  from the position-10 character) as the baseline, plus checksum
  verification. "Detailed" output (`Engine`, `Transmission`, `Body`) is
  explicitly manufacturer-specific and the README lists only **AvtoVAZ, Ford
  Australia, Nissan, Opel and Renault** as having that extra decode table,
  and BMW is not among them. Source:
  [pypi.org/project/vininfo](https://pypi.org/project/vininfo/).
- **`vin-decoder`** (npm, `germanrdz/vin-decoder`), decodes WMI into
  region/country/manufacturer and exposes the raw VDS/VIS sections, but its
  own docs state plainly: "Manufacturer-specific details (like exact model,
  trim, etc.) require additional databases not included in this basic
  decoder." Source:
  [github.com/germanrdz/vin-decoder](https://github.com/germanrdz/vin-decoder).
- Other npm hits (`@cloud20x/vin-decoder` / `vin-lite`, `@kargain/vincent`,
  the BeepAway VIN tool) are the same shape: an offline WMI table (600-2000+
  codes) plus ISO 3779 checksum/year-table logic, zero network calls, zero
  vehicle-spec data.
- `nhtsa-vin-decoder` and `pyvin` (PyPI) are wrappers _around_ the NHTSA vPIC
  API itself (one adds an offline WMI fallback), not independent decoders, so
  they inherit vPIC's US bias from section 1 for anything beyond the WMI.

**Confirmed, not just expected:** every maintained open-source library found
stops at manufacturer/country/plant/year-candidate plus checksum validation.
None return engine code, trim, or paint for BMW. They are free, dependency-light,
and good for the one job they do: validate a visitor-typed VIN and reject
typos/garbage before it reaches any paid API call.

## 3. Paid European-market VIN-decode APIs

### Vincario / vindecoder.eu

The brand running vindecoder.eu has rebranded to vincario.com ("We've Moved!"
banner on the old domain). Its own marketing page lists the `decode` response
shape directly, with a live example (Ford Galaxy) showing **48 named fields**:
Make, Model, Model Year, Product Type, Body, Series, Drive, Fuel Type -
Primary, Number of Gears, Emission Standard, Manufacturer, Manufacturer
Address, Plant Country, Engine Manufacturer, Engine Type, Average CO2
Emission, Number of Wheels/Axles/Doors/Seats, Front/Rear Brakes, Brake System,
Suspension (front/rear), Steering Type, Wheel Rims Size, Wheelbase,
Height/Length/Width, Rear Overhang, Track Front/Rear, Max Speed, Trunk
Capacity (min/max), Weight (empty/max), Max roof load, Permitted trailer load,
ABS, Check Digit, Sequential Number. Source:
[vindecoder.eu/api](https://vindecoder.eu/api/) (mirrors
[vincario.com](https://www.vincario.com/)).

**No paint code, no interior trim code, no fluid-fill volumes anywhere in that
field list.** It is a richer generic spec decode than vPIC (BMW is correctly
recognised, with real engine/body/series data), but it still stops at the
same altitude as a window sticker, not an ETK parts breakdown.

Other endpoints confirmed from the API's own GitHub profile
([github.com/api-evangelist/vincario](https://github.com/api-evangelist/vincario)):
OEM VIN Lookup, OEM Service History, Vehicle Market Value, Stolen Check,
Credit Balance, and an Enums reference endpoint. Base URL
`https://api.vincario.com/3.2`, auth via API key + a SHA1 control-sum path
segment (no bearer tokens).

Pricing: Vincario's own pricing page (JS-rendered, so exact tier numbers
couldn't be scraped directly) confirms the model: **3 free VIN lookups/month,
no credit card required**, monthly (not annual) subscription tiers above
that, with an "always active, overage billed per-lookup" or "pause at quota"
choice. Source: [vincario.com/pricing](https://www.vincario.com/pricing).
Third-party resale listings (Zyla Labs / RapidAPI marketplace, _not_
Vincario's own pricing, flagged as such) show roughly: Basic $49.99/mo for 500
requests, Pro $99.99/mo for 2,000, Pro Plus $199.99/mo for 7,000, Premium
$499.99/mo for 15,000. Treat these as indicative only, not Vincario's
official rate card.

### carVertical (Business API)

carVertical's business/API page (https://www.carvertical.com/en/business/api)
is marketing-only: no sample JSON, no field list, no self-serve pricing (it
gates everything behind "Request a demo" / "Contact us"). Its consumer-facing
pricing page lists single-report pricing around **EUR 27.99** (one report) /
**EUR 53.97** (three), and B2B bundle pricing "from EUR 119.90 for 10
reports." Its product is explicitly history/market-value oriented (damage,
odometer, "US-origin alerts"), not a parts-spec decode, and no evidence was
found of paint/trim/fluid depth, nor any public docs to check further.

### autoDNA

Found as a real competitor, but it is a **vehicle-history report product**,
not a self-serve VIN-decode API: no public REST endpoint or developer docs,
only a partner-gated "WebAPI." Pricing from its own-market pages: **EUR 24.99
for a single report, down to roughly EUR 9.59/report at a 100-report
Enterprise tier.** Strongest coverage is CEE registries (Poland, Czechia,
Slovakia), not spec depth. No evidence of BMW paint/trim/fluid data.

### VehicleDatabases.com (Europe VIN Decode API)

A genuine dedicated-Europe product with public docs
([vehicledatabases.com/docs/api-documentation/europe-vin-decode](https://www.vehicledatabases.com/docs/api-documentation/europe-vin-decode/)).
Its own sample response lists: Squish VIN, serial number, Make, Model, Trim
level, Body style, Engine type, Fuel type, Transmission, Vehicle class,
Vehicle type, "Manufactured in", Manufacturer name/city/region/country, Body
type, doors, seats, displacement (SI/CID/nominal), engine valves/cylinders/
horsepower/kW, driveline, ABS. It explicitly names BMW, Mercedes-Benz, Audi,
Volkswagen and Porsche as covered German brands
([vehicledatabases.com/api/vin-decoder/europe](https://www.vehicledatabases.com/api/vin-decoder/europe)).
Same ceiling as Vincario: no paint code, no interior trim code, no fluid
volumes. Pricing is not published (15 free credits, then "book a demo").

### Verdict on paid options

None of the four paid European VIN-decode products found (Vincario,
carVertical, autoDNA, VehicleDatabases) publish evidence of reaching
germsp.ru/ETK-style depth: paint code, interior trim code, fluid-fill
volumes, exact factory production date. They all plateau at "window sticker"
level: make/model/trim/body/engine type/displacement/transmission/dimensions.
That extra layer of detail is not a VIN-decode product category at all; it
lives in OEM dealer parts-catalogue systems (BMW's own ETK/EPC, or
TecDoc-style aftermarket equivalents), which decode the VIN internally only
as a lookup key into their own parts-fitment database rather than exposing it
as a general-purpose spec API.

## 4. TecDoc overlap flag

TecAlliance's own product pages state TecDoc's catalogue data already
includes a VIN/VRM lookup ("Vehicle Identification Service") tied directly to
its parts-fitment linkages (724M+ vehicle-to-part linkages), so a TecDoc
licence might already come bundled with the VIN-decode step carlab.rs needs,
rather than requiring a separate decoder vendor. Source:
[tecalliance.net/solutions/tecdoc](https://www.tecalliance.net/solutions/tecdoc).
This overlap is the subject of a sibling research ticket and is not explored
further here.

## Comparison table

| Option                                             | Coverage for BMW/German VINs                                                                               | Depth of detail                                                                                                           | Cost                                                                                                                            | Integration shape                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| NHTSA vPIC                                         | Resolves WMI/manufacturer/plant only; check-digit + model-year validation fail on EU VINs (confirmed live) | Manufacturer/plant only; model, engine, trim, body all blank                                                              | Free                                                                                                                            | REST API (JSON/XML/CSV)                     |
| `vininfo` (PyPI) / `vin-decoder` (npm) and similar | Works for any ISO 3779 VIN: country/region/manufacturer, year-candidate, checksum                          | WMI-level only; extra engine/trim tables exist for AvtoVAZ/Ford AU/Nissan/Opel/Renault, not BMW                           | Free (open-source libraries)                                                                                                    | Embedded library (npm/pip), no network call |
| Vincario (vindecoder.eu)                           | Good: recognises BMW, returns real engine/body/series/dimensions                                           | Spec-level (~50 fields), no paint/trim/fluid                                                                              | 3 free lookups/mo, paid subscription tiers above that (reseller listings suggest roughly $50-$500/mo for 500-15,000 lookups/mo) | REST API, self-serve docs + GitHub samples  |
| carVertical Business API                           | Unclear (no public field list); consumer BMW-capable                                                       | History/market-value focus; spec depth undocumented                                                                       | Consumer ~EUR 28/report; B2B custom, "from EUR 119.90/10 reports"                                                               | REST API, contact-gated for B2B             |
| autoDNA                                            | Strong CEE registry data, general EU coverage                                                              | Vehicle-history report, not spec; no public decode fields                                                                 | EUR 24.99/report down to ~EUR 9.59/report at volume                                                                             | Partner-only WebAPI, no public docs         |
| VehicleDatabases.com Europe VIN Decode             | Explicitly names BMW/Mercedes/Audi/VW/Porsche                                                              | Spec-level (~20 fields: make/model/trim/body/engine type/displacement/cylinders/hp/kW/driveline/ABS), no paint/trim/fluid | 15 free credits, then contact for pricing                                                                                       | REST API, public docs                       |
| TecDoc (flag only)                                 | Not evaluated here (sibling ticket)                                                                        | Possibly deeper, since tied to OE parts fitment rather than a generic spec API                                            | Enterprise licensing                                                                                                            | REST API bundled with parts-catalogue data  |

## Recommendation for the carlab.rs BMW pilot

1. **Use a free open-source ISO 3779 library (`vininfo`-equivalent) for VIN
   validation at the point of entry**: reject malformed/mistyped VINs before
   they reach any paid call, and get manufacturer/country/plant for free.
   Zero cost, zero vendor lock-in, matches the owner's "free first" ask.
2. **Do not rely on NHTSA vPIC for this pilot.** The live test above shows it
   structurally fails to validate and mostly fails to decode a European BMW
   VIN. It is a US-market tool, not a gap carlab.rs can work around with
   better input.
3. **Treat "VIN decode" and "BMW parts-fitment spec" as two separate
   purchases, because the research shows they are two separate products.**
   No generic VIN-decode API, free or paid, reaches the paint-code/interior-
   trim/fluid-volume depth germsp.ru shows; that lives in OEM EPC/ETK or
   TecDoc-style parts-catalogue data, which the sibling ticket is
   investigating. Buying a VIN-decode subscription alone will not get
   carlab.rs to germsp.ru-equivalent spec depth.
4. **If/when paid model/engine/trim identification is needed as a stepping
   stone** (e.g., to pre-fill a search form or validate a VIN really is a
   2-litre BMW before quoting parts), Vincario (vindecoder.eu) is the best
   evaluated option: self-serve docs, GitHub code samples, a free monthly
   tier to prototype against, and confirmed BMW-capable spec fields. It is
   still a stepping stone, not the destination: it won't return paint code,
   trim code, or fluid volumes, so the real fitment data has to come from
   wherever the sibling TecDoc/EPC research lands.
5. **Resolve the TecDoc overlap ticket before buying any paid VIN-decode
   subscription.** If TecDoc (or an OEM EPC equivalent) already includes VIN
   decoding as part of its parts-fitment package, a separate Vincario/
   VehicleDatabases subscription may be redundant spend for the pilot.
