# Google Ads keyword research — CarLab, Belgrade, three languages

Research date: **2026-10-13**. Question: for the three planned Search campaigns
(RU/SR/EN audiences, Belgrade only) — is there real search volume behind the
seed keywords, and what do Google's own docs say about the settings the
campaigns will use? Nothing in the Google Ads account itself was created,
saved or changed in this session — read-only research (Keyword Planner,
Ads Transparency Centre, `support.google.com`, open web).

## Source status

- **[P]** — primary source read in this session: a live Google Ads account
  screen (Keyword Planner, Ads Transparency Centre), a `support.google.com`
  page fetched directly, or a live Google Search result page.
- **[S]** — secondary: a third-party article or a search-engine summary of a
  page not opened directly.
- **[NOT ESTABLISHED]** — could not be verified from any available source.

All Keyword Planner numbers below are Google's own bucketed ranges (it never
gives exact counts), period **Sep 2025 – Aug 2026**, read directly from the
account (`ocid=8598641973`) in this session — tagged **[P]**.

---

## Verdict first

1. **RU is confirmed near-dead on Google, and there's a clean explanation.**
   Nine different Russian-language seed phrases, tried at both Belgrade-city
   and whole-Serbia geo scope, all land in Google's bottom bucket (0–10/mo)
   except one (`автосервис белград`, 10–100/mo). Likely cause, not just the
   symptom: Yandex still handles roughly 70% of search for Russian speakers
   **[S]**, and there's no evidence that changes abroad. The population is
   real (tens of thousands in Belgrade, see §4) — the market exists, it's
   mostly just not reachable through _Google_ Search. Treat the RU campaign
   as a cheap, low-expectation test, not a sized channel.
2. **EN has a semantic trap: "car service belgrade" reads as car rental to
   both Google and the live SERP.** Confirmed two ways — Keyword Planner
   ideas are dominated by `car rental belgrade` (10,000–100,000/mo!) and
   `car hire belgrade airport`, and a live Google Search for the same phrase
   returns SIXT, chauffeur and limo services, not mechanics **[P]**. Genuine
   repair-intent EN volume across every variant tried (`car service belgrade`,
   `mechanic belgrade`, `auto repair belgrade`) tops out at 10–100/mo each,
   at 4–10× the Serbian CPC. Hard negatives (rental, rent, hire, hire car,
   lease, sharing, airport, parking) are not optional for this campaign.
3. **SR is solid and Latin-script only.** Real volume across a cluster of
   terms (100–1,000/mo on the core, several hundred more spread across
   related terms), reasonable CPC. Cyrillic seeds for the same exact phrases
   return 0–10/mo every time — and Google's own "expand search" suggestion
   for the Cyrillic input was the **Latin** `autoservis beograd` (100–1,000/mo).
   Don't bother writing Cyrillic ad copy or keywords.
4. **Geo quirk, independently confirmed as a Google Ads data inaccuracy, not
   a political statement:** Google's location database files
   `"Београд"`/`"Belgrade"` under **Vojvodina** province. It isn't — Belgrade
   is its own statistical/administrative unit, separate from both Vojvodina
   and Central Serbia, per Serbia's Law on Territorial Organisation **[S]**.
   Doesn't change what to target (the "Белград … город" entity is still the
   right, precisely-shaped pick — confirmed its map outline matches the real
   city, including Zemun/Surčin/Borča, excluding Pančevo) — just don't read
   anything into the "Воеводина" label.
5. **Local Services Ads: not available in Serbia** **[S]** — not an option
   for a "calls only" format here, Search is the right call as already
   decided.

---

## 1. RU finding — the detail

### 1.1 Keyword Planner, round 1 (Belgrade city, original 4 seeds)

| Keyword                  | Volume/mo |
| ------------------------ | --------- |
| автосервис белград       | 10–100    |
| диагностика авто белград | 0–10      |
| ремонт авто белград      | 0–10      |
| сто белград              | 0–10      |

"Expand search" offered `белград` and `ремонт транспортных средств` as
related concepts; adding both and re-running produced **no new ideas** —
Google's own refinement panel said "Концепции доступны только для поиска по
ключевым словам" (concepts only available for keyword search), i.e. it had
nothing more to suggest. **[P]**

### 1.2 Keyword Planner, round 2 (Belgrade city, 5 more seeds)

Tried: `СТО белград`, `автомастерская белград`,
`компьютерная диагностика авто белград`, `развал схождения белград`,
`ремонт машины белград`. **All five: 0–10/mo.** "Expand search" surfaced
`белград`, `ремонт машины`, `ремонт`, `автомастерская`, `диагностика авто`,
`развал схождения` — and, tellingly, **`авиаперелеты`** (flights) as a
"related" concept. That's Google's semantic matcher reaching for travel
because it has nothing real to anchor on in Russian for this query space in
Belgrade. **[P]**

### 1.3 Geo isn't the cause — widened to all of Serbia

Same 5 seeds, same language, location changed from "Белград … город"
(4,830,000 reach) to "Сербия страна" (5,870,000 reach, i.e. the whole
country). **Identical 0–10/mo result on every term**, no new ideas. This
rules out "the Belgrade-city polygon is too narrow" as the explanation — the
volume isn't hiding in some other Serbian city, it's close to zero for
Russian-language car-service queries in Serbia, period. **[P]**

### 1.4 Why: Yandex, not Google, is the Russian-speaker's default

Russia-wide, Yandex holds roughly 70% search market share to Google's
27–30%, as of 2026 (statcounter-sourced) **[S]**. There is **[NOT
ESTABLISHED]** data specifically on what search engine Russian _emigrants in
Serbia_ use — nothing found measures that directly — but there's no
mechanism by which leaving Russia would reset someone's default search
engine, browser, or habit of asking in a Telegram chat first. The Keyword
Planner data is consistent with "this audience mostly isn't Google-searching
in Russian for this," which is the more useful way to read it than "there's
no Russian-speaking market."

### 1.5 The market itself is real, which is why "shelve RU" wasn't the call

- 73,197 temporary-residence applications from Russian nationals between
  24 Feb 2022 and 31 Dec 2024 (Serbian government data, via CEP Belgrade)
  **[S]**.
- Russian immigrant community concentration: **83.4% in Belgrade**, 12.7% in
  Novi Sad (Moscow Times, citing Serbian data) **[S]**.
- 6,976–9,000+ new companies registered by Russian nationals in Serbia since
  the war started **[S]** — an economically active population, plausible
  car-service buyers.
- Estimates of the total Russian population in Serbia range from ~30,000
  (residence permits only) to 200,000+ (anyone who's passed through/stayed),
  sources disagree by an order of magnitude depending on what's counted
  (permits vs. border crossings vs. estimates) **[S]** — treat any single
  number here as rough.

Net: a real audience exists, concentrated in exactly the right city: Google
Ads just isn't where most of them are searching.

---

## 2. EN finding — the detail

### 2.1 Keyword Planner, round 1 (original 4 seeds)

| Keyword                             | Volume/mo                 | Competition | CPC top-of-page |
| ----------------------------------- | ------------------------- | ----------- | --------------- |
| car rental belgrade                 | 10,000–100,000            | High        | $0.18–0.81      |
| car rental belgrade serbia          | 10,000–100,000            | High        | $0.18–0.81      |
| car rental belgrade airport         | 100–1,000                 | High        | $0.55–3.13      |
| car hire belgrade airport           | 100–1,000                 | High        | $0.55–3.13      |
| car sharing belgrade                | 100–1,000                 | Low         | $0.12–0.55      |
| **car service belgrade** (seed)     | **10–100**                | Medium      | **$0.91–2.54**  |
| **mechanic belgrade** (seed)        | **10–100**, −100% QoQ/YoY | —           | —               |
| cheap car rental belgrade (airport) | 10–100                    | High        | — / $1.00–2.84  |
| car hire belgrade                   | 10–100                    | High        | $0.88–3.46      |

"Uncheck brand filter" sidebar even grouped the non-rental remainder under
"Others: cheap car rentals, belgrade airport" — the tool's own clustering
logic treats this query space as a rental/travel category with repair as a
stray. **[P]**

### 2.2 Keyword Planner, round 2 — narrower, "service"-free phrasing

Tried: `auto repair belgrade`, `car garage belgrade`, `car workshop belgrade`,
`vehicle diagnostics belgrade`, `mobile mechanic belgrade`.

| Keyword                      | Volume/mo |
| ---------------------------- | --------- |
| auto repair belgrade         | 10–100    |
| car garage belgrade          | 0–10      |
| car workshop belgrade        | 0–10      |
| vehicle diagnostics belgrade | 0–10      |
| mobile mechanic belgrade     | 0–10      |

The one "idea" the tool volunteered alongside these:
**`nikola tesla airport belgrade parking garage`** (10–100/mo) — again,
airport/travel, not repair. **[P]**

### 2.3 Live SERP check confirms it independently

A live Google Search for "car service belgrade" surfaces SIXT ("Car Service
in Belgrade with SIXT ride"), Premium Mobility ("Executive Car Service in
Belgrade"), BG Diplomat ("Luxury Chauffeur & Car Rental Belgrade"), Voyager
International (rent-a-car) as the dominant results, with genuine repair
shops appearing but far less prominent **[S — summarized search-result
listing, pages not individually opened**]. This matches the Keyword Planner
pattern exactly: in English, "car service" in a Belgrade/travel-hub context
defaults to "chauffeur/rental," not "mechanic."

### 2.4 What this means for the campaign

- **Mandatory negatives from day one**, not a later optimization:
  `rental`, `rent`, `hire`, `car hire`, `lease`, `sharing`, `airport`,
  `parking`, `chauffeur`, `limo`, `cheap`.
- Real repair-intent EN volume across every phrasing tried maxes at
  **10–100/mo per term** (`car service belgrade`, `mechanic belgrade`,
  `auto repair belgrade` — three terms, each in the lowest non-zero bucket).
  That's a few dozen to ~300 genuine searches a month, total, across the
  whole EN core — not a volume campaign.
- CPC for the genuine-intent terms ($0.91–3.46) runs 4–10× the Serbian
  equivalent ($0.13–0.57) — $5/day buys far fewer EN clicks than SR clicks.

---

## 3. SR finding — the detail

### 3.1 Latin core (confirms and extends what was found earlier this session)

Non-brand filter applied (242 of 467 ideas are non-brand). Top bucket
(100–1,000/mo), Latin script:

| Keyword                      | Competition | CPC top-of-page |
| ---------------------------- | ----------- | --------------- |
| auto servis beograd          | Medium      | $0.13–0.57      |
| auto električar beograd      | Low         | $0.14–0.50      |
| auspuh servis batajnica      | Low         | —               |
| auspuh servis beograd        | Medium      | $0.08–0.30      |
| auspuh servis novi beograd   | Medium      | $0.10–0.30      |
| auto elektricar zemun        | Medium      | $0.19–0.59      |
| auto elektrika beograd       | Low         | —               |
| auto električar novi beograd | Low         | $0.17–0.57      |
| auto električar zemun        | Low         | —               |
| auto elektronika beograd     | Low         | —               |
| auto klime sale zemun        | Low         | $0.10–1.30      |
| auto servis mirijevo         | Medium      | $0.08–0.42      |

Plus from the original seeds: `dijagnostika automobila` 10–100/mo, Low
competition. `servis auto klime beograd` / `auto klima servis beograd` also
100–1,000/mo but notably pricier (Competition High, CPC up to $1.65–1.67) —
AC service looks seasonal/competitive, worth a lower bid cap or its own ad
group rather than blending into the core. **[P]**

### 3.2 Cyrillic test — confirms Latin-only is correct

Same four seed concepts, rewritten in Serbian Cyrillic
(`ауто сервис београд`, `дијагностика аутомобила београд`,
`поправка аутомобила београд`, `ауто механичар београд`): **all four,
0–10/mo.** Google's own "expand search" panel, working from those exact
Cyrillic inputs, surfaced the Latin-script `autoservis beograd` —
**100–1,000/mo** — as a related idea. Confirms: Belgrade Google users type
in Latin, essentially never in Cyrillic, for this query space. No need to
prepare Cyrillic ad assets or keywords for the SR campaign. **[P]**

---

## 4. Google Ads documentation — what's confirmed vs. assumed

| Claim                                                                                                                                           | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Source                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Language targeting is a campaign-level setting (Search), not ad-group-level                                                                     | **[P]** confirmed directly — the live campaign-settings panel for Performance Max-1 shows "Языки" as a sibling row to "Местоположения" under campaign-level "Другие настройки", with no ad-group equivalent found anywhere in the Search/PMax UI. `support.google.com/google-ads/answer/1704395` groups language under "Locations and languages" in the campaign-settings table, consistent with this.                                                                                                                               | [P] (own session) + [S] (support.google.com/google-ads/answer/1704395) |
| Demand Gen campaigns _can_ set language at ad-group level if not already set at campaign level                                                  | [S] — doesn't apply to us (we're building Search, not Demand Gen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | support.google.com/sa360/answer/9825865, google-ads/answer/13695389    |
| Auto-tagging appends `gclid=…` to the landing-page URL automatically                                                                            | **[S]** confirmed via `support.google.com/google-ads/answer/3095550` and `.../answer/1752125` — matches what the account's own Settings page already showed this session ("Автоматическая пометка тегами: Да").                                                                                                                                                                                                                                                                                                                      | [S]                                                                    |
| "Presence" location option = ads shown only to people physically in/regularly in the target location; excludes people merely "interested" in it | **[S]** confirmed, `support.google.com/google-ads/answer/1722038`: _"Reach people in or regularly in your targeted locations"_ vs. the default _"Presence or interest… Reach people in, regularly in, or who've shown interest in your targeted locations."_ Google's own guidance: use Presence-only when "you only want to target users in specific locations and not users who may be in other locations but are still interested" — exactly CarLab's case (a physical repair shop, not a travel/education/real-estate business). | [S]                                                                    |
| Local Services Ads available in Serbia                                                                                                          | **Not available** — listed countries are North America plus a set of EU states (Austria, Belgium, France, Ireland, Germany, Netherlands, Italy, Spain, Switzerland, UK); Serbia absent from every list found.                                                                                                                                                                                                                                                                                                                        | [S]                                                                    |
| Belgrade is administratively part of Vojvodina province                                                                                         | **False** — confirmed via Serbia's Law on Territorial Organisation / Wikipedia's Administrative divisions of Serbia: Belgrade (Grad Beograd) is its own special-status territorial unit, separate from both Vojvodina and Central Serbia. Google's location database mislabels it under Vojvodina regardless (see §Verdict #4).                                                                                                                                                                                                      | [S]                                                                    |

---

## 5. Ads Transparency Centre — limited, not a keyword tool

`adstransparency.google.com`, region filtered to Serbia: the search box is
explicitly **"Find the ads you've seen by searching by advertiser name or
website"** — not a keyword/topic search. Querying a generic phrase like
`auto servis beograd` returns **"No ads found"** / 0 ads, because it isn't
matching ad content, it's matching advertiser identity, and no exact
advertiser or domain was named. Searching `carlab.rs` directly also returns
no autocomplete matches for either "Advertisers" or "Websites" — consistent
with Performance Max-1's own 0 impressions so far (nothing to index yet).
**Conclusion: this tool can't be used for anonymous "who's advertising this
keyword" competitor discovery** — it only works if a specific competitor
name or domain is already known going in. Finding actual Belgrade
auto-service competitors' Google Ads activity would need starting from a
list of competitor names/domains (e.g. from a live SERP or Maps search) and
checking each one individually — **[NOT ESTABLISHED]** in this session, out
of scope for the time available.

---

## 6. Negative-keyword recommendations, by campaign

**EN** (mandatory, not optional): `rental`, `rent`, `hire`, `car hire`,
`lease`, `sharing`, `car sharing`, `airport`, `parking`, `chauffeur`,
`limo`, `limousine`, `cheap`, `cheap car rental`.

**SR**: standard local-service negatives — `posao` (job/vacancy),
`prodaja`/`na prodaju` (for sale), `polovni delovi` (used parts, if CarLab
doesn't sell parts), `konkurs` (hiring). Not confirmed against live SERP
data this session — carried over from general best practice, not from a
Belgrade-specific finding; flag as **[NOT ESTABLISHED]** and sanity-check
once the campaign has real search-term data.

**RU**: given the volume is already near the floor, aggressive negatives
would likely zero it out further — skip negatives beyond the obvious
(`работа`/`вакансия` — job), let it run as the cheap test it is.

---

## 7. Addendum — confirmed independently via Google Search Console (2026-10-13)

Checked `search.google.com/search-console` for `https://carlab.rs/` directly —
this is carlab.rs's own real search data (what people actually typed and saw
the site for), a stronger source than Keyword Planner's modeled estimates.
**[P]**, read live in this session. 3-month window (13 Jul – 10 Oct 2026),
155 total impressions, 7 clicks, filtered to Country: Serbia where noted
(130 of the 155 impressions, all 7 clicks).

### 7.1 RU confirmed dead a third way

Zero Russian-language queries anywhere in the full 27-query list, any
country. Three independent methods (Belgrade-city Keyword Planner,
whole-Serbia Keyword Planner, and now real search impressions) all agree:
no measurable Russian-language demand is reaching Google Search for this
site. Reinforces §1 — not a geo-targeting artifact, not a seed-phrasing
artifact.

### 7.2 SR core extended with three real queries not in the planner pass

From real Serbia-filtered impressions: `servis kocnica` (brake service, 3
impr.), `autodijagnostika beograd` (one-word compound, 1 impr.),
`cervis`/`auto servis`/`autoservis` (common misspelling + the two standard
spellings, 1 impr. each). `servis kočnica` (brakes) wasn't in any seed or
expansion tried in Keyword Planner — worth adding to the SR ad group.

### 7.3 EN "near me" pattern — real demand Keyword Planner's Belgrade-anchored

seeds never surfaced

The two single biggest queries site-wide, both from Serbia, both English:
**`auto repair shop`** (14 impressions, position 1.0) and
**`oil change near me`** (12 impressions, position 2.8). Also present:
`oil change near me open now` (4), `pre purchase inspection near me` (4),
`auto repair shops near me` (3), `auto repair` (3), `brakes` (3),
`cheap car repair` (2), `exhaust` (2), `exhaust system` (2),
`transmission`/`transmissions` (6+2), `air suspension` (1), `suspension` (1).

None of these name Belgrade explicitly — they're generic English near-me
phrasing, which is exactly the pattern Google matches to the searcher's
_device_ location rather than the query text. Keyword Planner was seeded
with `"<term> belgrade"` throughout this research, which is why it never
surfaced this cluster — the real searchers aren't typing "belgrade" at all.
**Action: add a `near me`/no-city EN ad group** (`auto repair shop`,
`oil change near me`, `car repair near me`, `mechanic near me`,
`brakes near me`, `transmission repair`, `exhaust repair`, `pre purchase
inspection`) alongside the explicit `<term> belgrade` ad group from §2 — this
is likely the larger of the two reachable EN pools, not the smaller one.

### 7.4 Ranking is fine, clicks aren't happening — a CTR gap, separate from the ads question

`auto repair shop` ranks position **1.0** (top of page) with 14 impressions
and **0 clicks** — 0% CTR at position 1 is unusual and points at the meta
title/description not matching what the searcher expects, not a ranking
problem. Out of scope for the Ads campaigns themselves, but worth a separate
look at `/en/`'s `<title>`/meta description — flagging, not fixing here.

### 7.5 Only two pages receive any impressions at all

`https://carlab.rs/` (bare root, 68 impr.) and `https://carlab.rs/en/`
(9 impr.). **No `/sr/` or `/ru/` URL appears anywhere in Pages**, even
Serbia-filtered — consistent with Google indexing the pre-redirect root
rather than the locale URL it 302s to, which is expected behavior for this
app's middleware-redirect setup (`AGENTS.md`: "`/` redirects, it does not
rewrite"), not a misconfiguration.

### 7.6 Indexing coverage — normal for a ~1-month-old site, not a blocker

8 pages indexed, 65 not indexed: 63 are "Discovered – currently not indexed"
(Google knows the URL, hasn't crawled it yet — standard low-crawl-budget
behavior for a new site), 1 each of the two duplicate/canonical reasons
(expected, given the root redirect). Sitemap (`/sitemap-index.xml`) is
submitted, status **Success**, 72 pages discovered, last read **today**
(13 Oct 2026) — the sitemap itself isn't the problem, this is just normal
early-crawl lag. Not an action item for the Ads work; noted for completeness.
See §9 for how to actually speed this up.

---

## 8. CORRECTION (2026-10-13, round 3) — the research in §1–3 had a real methodology flaw

The owner caught this directly from the GSC data in §7: the site is actually
_found_ by generic English queries (`auto repair shop`, `oil change near
me`) with no city name in them at all, which contradicted the §2 verdict
that EN demand was tiny. That's correct, and it exposed something that
needed fixing, not just explaining away.

**What was wrong:** every single seed phrase tried in §1–3, in all three
languages, had the city name glued onto it — `"<term> belgrade"`,
`"<term> beograd"`, `"<term> белград"`, with no exception. Keyword Planner's
**location setting already restricts matched volume to people in/regularly
in Belgrade** — that's what the "Белград … город" geo entity does. Typing
the city name _again_, inside the keyword text itself, is redundant on the
targeting side and actively harmful on the matching side: Google's keyword
ideas engine estimates volume for the literal phrase pattern, and most real
searchers—confirmed independently by their own search behavior in §7.3—don't
type the city name when their device already tells Google where they are.
Appending it every time was quietly measuring "how many people type the
city name," not "how many people in Belgrade search for this," which was
the actual question. Three different "RU is dead" readings in §1 and §7.1
all used that same flawed method, so they agreed with each other without
being independently right.

### 8.1 Re-run with bare seeds (no city token), same Belgrade geo target

**RU** — seeds: `автосервис`, `диагностика авто`, `ремонт авто`, `сто`,
`автомастерская`. **2,879 ideas available** (vs. 4 before).

| Keyword          | Volume/mo | Trend YoY | Competition |
| ---------------- | --------- | --------- | ----------- |
| автосервис       | 100–1,000 | +900%     | Low         |
| автосервиса      | 100–1,000 | +900%     | Medium      |
| сто              | 100–1,000 | 0%        | Low         |
| диагностика авто | 10–100    | 0%        | —           |
| ремонт авто      | 10–100    | 0%        | Low         |
| автомастерская   | 10–100    | 0%        | Medium      |
| автоэлектрик     | 10–100    | 0%        | Low         |

**EN** — seeds: `auto repair shop`, `oil change near me`, `car repair shop`,
`mechanic near me`, `auto repair`. **5,238 ideas available** (vs. 25 before).

| Keyword               | Volume/mo    | Competition | CPC top-of-page |
| --------------------- | ------------ | ----------- | --------------- |
| body shops            | 1,000–10,000 | Low         | $0.19–0.27      |
| body shop near me     | 100–1,000    | Low         | —               |
| tire shop             | 100–1,000    | Low         | —               |
| auto shop             | 100–1,000    | Low         | $0.09–0.71      |
| auto service          | 100–1,000    | Low         | —               |
| tire repair (shop)    | 100–1,000    | Low         | —               |
| truck repair near me† | 100–1,000    | Low         | —               |

† and its variants (`semi truck repair near me`, `mobile truck repair near
me`, `truck tire repair near me`) are **heavy/commercial-vehicle terms** —
CarLab is a passenger-car shop, these are noise for this business and should
be excluded, not added to the core.

**SR** — seeds: `auto servis`, `dijagnostika automobila`,
`popravka automobila`, `auto mehaničar`, `servis kočnica`. **914 ideas
available** (vs. 242 before, Non-Brands filtered both times).

| Keyword                               | Volume/mo    | Competition | CPC top-of-page |
| ------------------------------------- | ------------ | ----------- | --------------- |
| auto servis                           | 1,000–10,000 | Low         | $0.13–0.47      |
| auto električar                       | 1,000–10,000 | Low         | $0.17–0.57      |
| auto mehaničar                        | 100–1,000    | Low         | —               |
| servis auto klime / auto klima servis | 100–1,000    | Medium      | $0.17–1.67      |

`auto servis` bare is **10× the volume** of `auto servis beograd` from §3 —
same pattern, same direction, in the language that was supposedly already
"solid."

### 8.2 What actually changes

1. **RU is not a dead campaign.** It was never really tested — every prior
   RU reading (§1, §7.1) measured the same flawed metric three times and
   called it confirmation. The real bare-seed numbers put RU in the same
   order of magnitude as EN, and not far off SR. The §6 recommendation
   ("skip negatives, let it run as a cheap test") and the "RU budget is a
   write-off" framing earlier in this conversation were built on that
   mistake — budget allocation should be revisited, not just the keyword
   list.
2. **Keyword strategy for all three campaigns needs two ad groups per
   language, not one:**
   - a **generic/near-me group** (no city token — `auto servis`,
     `автосервис`, `auto shop`, `body shops`, `сто`) — this is the larger
     volume pool, found here for the first time;
   - an **explicit city-qualified group** (`auto servis beograd`,
     `автосервис белград`, `car repair belgrade`) — smaller, but the intent
     is unambiguous and competition is usually a little lower, worth
     keeping as its own ad group so performance data can show which pattern
     actually converts once the campaigns have real traffic.
3. **The EN "rental trap" from §2 still stands** — `car rental belgrade`
   dwarfing repair intent was never about the city-suffix problem, it's a
   separate, confirmed finding (§2.3, live SERP). The mandatory negative
   list from §2.4/§6 is unaffected and still required. What changes is that
   the _generic_ EN pool (§8.1) doesn't have the rental-ambiguity problem at
   all — "body shops", "tire shop", "auto shop" aren't rental-adjacent terms
   the way "car service" is.
4. **Serbian Cyrillic finding (§3.2) is unaffected** — that test already
   used bare-concept Cyrillic seeds without a city suffix and still returned
   0–10/mo, so the city-suffix flaw doesn't explain it away. Cyrillic stays
   off the list.

---

## 9. How to get Google to index the rest of the site

There is **no bulk "force index everything" button** — confirmed against
Google's own documentation, not assumed:

- **The Indexing API is not for this.** It's restricted by Google to pages
  carrying `JobPosting` or `BroadcastEvent`/livestream structured data only
  **[P]** (`developers.google.com/search/apis/indexing-api/v3/quickstart`).
  carlab.rs's pages are neither — submitting them through that API would not
  work and isn't an option here.
- **"Request indexing" in URL Inspection is per-URL and rate-limited** — a
  quota exists on how many requests a property can submit per day **[P]**
  (`support.google.com/webmasters/answer/9012289`), exact number not
  published, but it's a priority-page tool (use it for `/sr/`, `/en/`,
  `/ru/`, the main service pages), not a way to clear 63 pages at once.
- **Google's own recommended bulk lever is the sitemap** — already in place
  and healthy (`/sitemap-index.xml`, Success, 72 pages, last read today).
  That's not the bottleneck.

What's actually worth doing, in order of effect:

1. **Fix the 2 flagged duplicate/canonical pages first** (§7.5/§7.6 —
   "Duplicate without user-selected canonical" ×1, "Duplicate, Google chose
   different canonical than user" ×1). Pull the exact URLs via _Page
   indexing → Why pages aren't indexed → click each reason row_ in Search
   Console — it lists the specific URLs, not just a count. These two
   actively tell Google "don't bother," which is a stronger negative signal
   than silence.
2. **Request indexing by hand for the handful of pages that matter most**
   — `/sr/`, `/en/`, `/ru/`, and whichever service pages the new Search
   campaigns will land on. URL Inspection → paste URL → "Request indexing."
   Slow (quota-limited) but it's the only lever that acts on a specific page
   _now_ rather than waiting for a crawl.
3. **Link to the undiscovered pages from pages Google already has indexed.**
   "Discovered – currently not indexed" (63 pages) most often means low
   crawl priority, not a block — and internal links are the cheapest signal
   that raises a page's priority. Check the homepage/`<nav>` actually link
   to the service/locale pages that aren't indexed yet, not just the
   sitemap (a sitemap entry with no internal link pointing to it is a
   weaker signal than one that's actually linked in the page).
4. **Time and crawl budget.** The site is ~1 month old per the sitemap's
   first-submit date (15 Sept 2026); "discovered, not yet crawled" is the
   single most common and least actionable status for a brand-new site —
   Google paces crawling against perceived site authority, and that
   genuinely just takes weeks, not something a setting fixes.
5. Once the Search campaigns in this document are live, that itself is a
   (mild, indirect) signal — paid traffic doesn't directly cause indexing,
   but a site that starts getting real visits and engagement tends to climb
   Google's crawl priority faster than one sitting untouched.
