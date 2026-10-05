# Turning case-study browsing into leads

Research date: **2026-10-05**. Issue #114: visitors browse approved.rs's case
studies, and the pages are built for reading, not for catching a reader who is
clearly warm by the second one. Before choosing a mechanic, measure what case
pages actually do.

## Source status

Same tags as the other files in `docs/research/`:

- **[P]**: primary. A Yandex Metrica Logs API pull made in this session, or a
  file in this repository.
- **[NOT ESTABLISHED]**: today's instrumentation cannot answer it.

Every number below is **[P]**. It comes from counter `111800377` via the Logs API,
with visits and hits joined on `watchIDs`. The window requested was
2026-06-01 → 2026-10-04, but the data starts on **2026-08-20**, so it covers
about 6.5 weeks. The mandatory exclusions of `docs/guides/analytics-exclusions.md`
were applied: 7 clientIDs removed 127 visits and the `Russia` region removed 16
more, leaving **305 of 448 raw visits**. Both log requests were cleaned afterwards.

Pages are classified as follows:

- **Tab:** `/cases/vehicle-{sourcing,import,inspection,buyback}/`, plus the
  retired `/cases/auto-service/` and `/cases/detailing/`.
- **Case:** every other `/cases/<slug>/`.
- A reload of the same URL counts once.

---

## Verdict first

1. **A fifth of visits touch `/cases/`, and they arrive from inside the site.**
   Case pages draw almost no search traffic: 2 organic landings in 6.5 weeks.
2. **Case pages do not convert today.** 1 form lead was submitted from a case page
   in the whole window. No contact click fired on a case page.
3. **Readers rarely reach the bottom.** `scroll_90` fires on about 12% of case
   views, against about 20% on service pages. A door at the very end of the page
   (after the gallery, the promo banner and the partner block) is a door almost
   nobody sees.
4. **A second case in a row is the warm signal that exists.** 15 of 47 case
   visitors open two or more cases, and a third of all case views lead to another
   case.
5. **The samples are small throughout.** These numbers set a direction. They do
   not prove one.

---

## 1. Reach

|                      | Visits | Share of 305 |
| -------------------- | ------ | ------------ |
| Any `/cases/` page   | 62     | 20%          |
| A tab page           | 35     | 11%          |
| An individual case   | 47     | 15%          |
| Both tab and case    | 20     |              |
| Case without any tab | 27     |              |

Pageviews: 84 on cases and 61 on tabs, against 299 on service pages and 255 on
the homepage. The most viewed cases were alfa-romeo-giulia (16 hits), vw-tiguan
(11), bmw-x1-x-drive (10), seat-leon (7) and the bmw-320-gt story (7).

## 2. Cases opened per visit (n = 47)

| Cases | Visits |
| ----- | ------ |
| 1     | 32     |
| 2     | 6      |
| 3+    | 9      |

This can be answered from the logs, but only after the fact. Nothing on the page
knows the depth, so a mechanic that reacts to depth needs its own per-visit
counter. Nothing in `packages/site-kit` counts pages today, and no app uses
`sessionStorage`.

## 3. Conversion

"Form" means a visit that reached `/thanks/` or fired `form_submit` (or the
matching auto-goal). "Contact" means `contact_click` or the messenger/phone
auto-goals.

| Group                      | n   | Form | Contact | Either   |
| -------------------------- | --- | ---- | ------- | -------- |
| Viewed ≥1 case             | 47  | 1    | 4       | 5 (11%)  |
| Viewed any `/cases/` page  | 62  | 4    | 6       | 9 (15%)  |
| No `/cases/` page          | 243 | 12   | 19      | 27 (11%) |
| No `/cases/`, ≥2 pageviews | 88  | 8    | 11      | ~19      |

The 5 converting case visits were checked one by one:

- All 4 contact clicks came from service pages, at least one of them before the
  case was viewed.
- The single form lead went case → `/thanks/`.
- A visit that viewed a case and converted is not evidence that the case caused
  it.

## 4. Where case views come from (84 views)

| Previous page              | Views |
| -------------------------- | ----- |
| Another case               | 27    |
| Tab                        | 22    |
| Service page               | 17    |
| Homepage                   | 9     |
| Landing (no previous page) | 9     |

The 9 landings were 5 direct, 2 organic search, and 2 with an approved.rs
referrer from an earlier visit.

## 5. Where case views go (84 views)

| Next page    | Views |
| ------------ | ----- |
| Exit         | 28    |
| Another case | 27    |
| Tab          | 11    |
| Service page | 11    |
| Homepage     | 3     |
| Other        | 3     |
| `/thanks/`   | 1     |

None of the 28 exits opened the modal or clicked a contact on the case page
first.

## 6. Reading to the end

`scroll_90` exists only since 2026-09-24, which leaves 107 visits. Goal hits carry
the page they fired on as their referrer, so they can be attributed to a page.

| Page class | Views since 09-24 | With `scroll_90` | Rate |
| ---------- | ----------------- | ---------------- | ---- |
| Case       | 34                | 4                | ~12% |
| Tab        | 19                | 5                | ~26% |
| Service    | 86                | 17               | ~20% |
| Homepage   | 81                | 4                | ~5%  |

## What could not be answered

- **[NOT ESTABLISHED]** Form and scroll behaviour before late September:
  `form_submit` exists from 2026-09-25 and the scroll goals from 2026-09-24.
- **[NOT ESTABLISHED]** Which page a messenger or phone auto-goal fired on. These
  goals are per visit, and only the code's `contact_click` carries a page.
- **[NOT ESTABLISHED]** A per-search-engine split of case landings. The sample is
  too small.
- A case left open in a background tab and abandoned looks the same as a
  deliberate exit.

---

## Decision

Decided with the owner on 2026-10-05:

- **Form after the body.** A contact-only form with messenger tiles goes straight
  after a case's text, before the gallery. That is where the reader still has the
  price and the outcome in front of them, and where more of them still are (§6).
  It carries the case's service, so the lead arrives scoped.
- **Depth door from the second case.** From the second case study in one visit,
  every further one shows a static block near the top. Its button is a plain
  anchor to the page's own form, which already carries the service. A modal was
  rejected because the brand sites' modals cannot take a service from their
  trigger. This targets the 15 of 47 visitors in §2 who browse on.
- **Depth is counted per visit, across tabs.** The slugs and the time of the last
  case view are kept in `localStorage`, and the list resets after 30 minutes
  without another case view (Metrika's visit timeout). `sessionStorage` was
  rejected because grid cards are often opened in new tabs. The counter runs
  regardless of analytics consent: it is the door's state, holds no identifier,
  and never leaves the browser.
- **A `case_view` goal with the depth.** This makes §2 and the door's effect
  measurable going forward.
- **All three sites.** carlab.rs and details.rs already end their work pages in a
  form-plus-tiles fold. They get the door and the goal, and CarLab's fold starts
  posting the work's service.
- **Rejected: keeping the form at the very bottom.** Only ~12% of case views get
  there (§6).
- **Rejected: an auto-opening modal or a sticky bar** for the depth door. The first
  breaks reading. The second competes with the floating contact widget on mobile.
- **Rejected: a stronger call to action on the tab pages** alone. Tabs are a
  through-route to cases (§4), not where readers stop.
- **Rename.** «Кейсы» becomes «Реальные сделки» on approved.rs. Details' «Работы»
  becomes «Наши работы». CarLab keeps «Примеры работ».
