# approved.rs: the white→dark repaint of 2026-09-14 and the reported lead drop

Research date: **2026-10-02**. Question from the owner: approved.rs was light until
around 15 September 2026 and leads were coming in; after the switch to a dark theme
with photographs, leads dropped. Is that causal, what exactly changed, and what in
the old design was driving action?

## Source status

Tags used below, same convention as `serbia-online-shop-legal.md`:

- **[P]** — primary source read directly: a commit object in this repository, a file
  at a named SHA, a GitHub Actions run, a Yandex Metrica report pulled in this
  session, or the text of a standard.
- **[S]** — secondary: a commit message or issue body asserting a measurement whose
  underlying data was not re-pulled here.
- **[NOT ESTABLISHED]** — could not be verified from any available source.

Every number in the "what the data shows" section was pulled from Metrica counter
`111800377` in this session with the mandatory exclusions of
`docs/guides/analytics-exclusions.md` applied (7 clientIDs from
`.local/analytics-exclusions.txt`, plus the `Russia` region). Raw: 417 visit rows,
124 dropped by clientID, 14 dropped as Russia, **279 kept**. [P]

---

## Verdict first

1. **The owner's memory of _what_ changed is exactly right, and it is one commit.**
   `5a9ee8d` (2026-09-14 17:07:27 +0800) deleted the light palette and the theme
   toggle, replaced the typefaces, changed the accent from navy to red, and added
   2.35 MB of new source photography including the first homepage hero photo the site
   ever had. It reached production at **2026-09-14T17:12:01Z** (GitHub Actions run
   `34873281542`, `deploy` job `success`, head `c507ef9`, branch `main`). [P]

2. **The lead numbers do not show a drop.** On the only two lead signals that are
   comparable across the date, absolute completions went _up or flat_:
   thanks-page URL goal **9 → 10 reaches**, Metrica's automatic form-submission goal
   **6 → 8 reaches** (pre 2026-08-15..09-14 vs post 09-15..10-01, exclusions applied). [P]
   What halved is the _rate_, 7.76% → 3.07% on the thanks page — and the denominator
   is not comparable, because the same week switched analytics from **opt-in to
   opt-out** (`3d1283a`, 2026-09-14 21:54 +0800). Before that date the counter only
   saw visitors who had clicked Accept on the cookie banner. [P]

3. **The CRM blob confirms it: no drop.** Added 2026-10-02 from the production
   `data/leads.json` — 36 Approved.rs leads, **1.57/d before vs 1.07/d after**
   (−32%, exact binomial **p = 0.31**), form submissions −22% (p = 0.61). The whole
   gap is a single five-lead day, 2026-09-11; remove it and the before-rate is
   **1.14/d against 1.07/d**. Full working in §3a. [P] The Metrica rate collapse in
   (2) is a measurement artefact, not behaviour.

4. **But one real, measured regression did ship in that commit**, and it is not the
   colour: on mobile — 92% of this site's traffic [S] — the lead form moved from
   **2428 px (third screen) to 7507 px down a 10320 px page (tenth screen)**. That
   figure is the repo's own measurement, recorded when it was reversed ten days later
   in `fb8f1da` (2026-09-24). [S] For those ten days the form was effectively gone
   for most visitors — and the lead store confirms it: **1 form submission in those
   9.3 days against 7 in the 7.6 days after the fix, p = 0.03** (§3a.1). That is the
   only significant result in the data, the palette is constant across that boundary,
   and the fixed-form rate (0.92/day) is **above** the light theme's (0.61/day). The
   repaint did not cost leads; the section reorder inside the same commit did. It is
   fixed and still correct at HEAD. [P]

5. **And the thing that most likely produced the _feeling_ of silence is a channel
   shift, not a volume drop.** Over the same split, form submissions fell while phone
   clicks rose, and a click arrives in Telegram with `contact: "—"` and boilerplate
   instead of a name, model and budget: "Of 24 such leads, 12 were never touched and
   none became a deal; of 10 form leads, 6 progressed and one closed" (`d9716d5`,
   2026-09-24). [S] Fewer _answerable_ leads at the same or higher total.

---

## 1. The timeline, with SHAs

Everything below is `git log` / `git show` in this repository, and GitHub Actions runs
in `Zikrasoft/approved_rs`. [P]

| when (author date)            | SHA                           | what                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-02 15:18 +0800        | `3dedd86`                     | repo init. `src/styles/global.css` ships `--color-bg: #F4F6FA` as the default and dark as an opt-in `[data-theme="dark"]` block. `light-theme.png` and `dark-theme.png` are committed screenshots.                                                                                                                             |
| 2026-07-24 23:19 +0800        | `05beca4`                     | "автоопределение тёмной/светлой темы по системным настройкам" — the FOUC script in `BaseLayout.astro` starts honouring `prefers-color-scheme` when no choice is stored. From here, a visitor whose OS is dark sees dark.                                                                                                       |
| 2026-07-27                    | `81a68a3`                     | the theme toggle moves into the mobile menu.                                                                                                                                                                                                                                                                                   |
| 2026-09-11 22:xx              | `28436f0`                     | monorepo move; `src/` → `apps/approved-rs/src/`. Palette unchanged.                                                                                                                                                                                                                                                            |
| 2026-09-12                    | `b3f0f3c`                     | "Drop autoservice and detailing from approved.rs, redirect to their own sites" — two whole service verticals leave the site.                                                                                                                                                                                                   |
| 2026-09-13                    | `527ba41`                     | last commit with a light default. `--color-bg: #f4f6fa`, `[data-theme='dark']` present.                                                                                                                                                                                                                                        |
| **2026-09-14 17:07:27 +0800** | **`5a9ee8d`**                 | **"Fill out the service pages and give them their own photography"** — the flip. Details in §2.                                                                                                                                                                                                                                |
| 2026-09-14 21:54 +0800        | `3d1283a`                     | "Ask before tracking…" — despite the subject, this **removes** consent-gating of Metrica. See §4.                                                                                                                                                                                                                              |
| 2026-09-14T17:12:01Z          | run `34873281542` (`c507ef9`) | first production deploy of approved.rs containing `5a9ee8d`. `deploy` job: `success`. Belgrade local time ≈ 19:12 on 2026-09-14.                                                                                                                                                                                               |
| 2026-09-15 13:31 +0800        | `06ae783`                     | analytics bootstrap extracted into `@podbor/site-kit`; GA4 still present.                                                                                                                                                                                                                                                      |
| 2026-09-15 15:54 +0800        | `59faa8d`                     | "Put an ordinary European sedan on the homepage hero" — hero photo swapped (654 990 → 332 891 bytes) and the caption claiming a specific delivered car deleted.                                                                                                                                                                |
| 2026-09-15                    | `19a0954`                     | brand counters added; `COOKIE_POLICY_VERSION` bumped — which re-prompts consent for every returning visitor.                                                                                                                                                                                                                   |
| 2026-09-16 07:47              | `180322d`                     | geo-suggestion banner deleted (`GeoBanner.astro`, −89 lines), cookie notice delayed.                                                                                                                                                                                                                                           |
| 2026-09-18 16:16 / 2026-09-19 | `2c4597e`                     | lead modal pinned to the viewport, submit bar unstuck.                                                                                                                                                                                                                                                                         |
| 2026-09-21 23:20 +0800        | `cb8e25a`                     | "Make the pages cheaper to paint and easier to read" — GA4 removed, Metrica moved to idle-after-`load`, hero served at the size it renders, and the accent **split in two**: `--color-accent: #ef6247` for text, `--color-accent-strong: #c8381f` for button grounds, "an accent red that cleared 4.5:1 in neither direction". |
| 2026-09-21                    | `435b9da`                     | "Halve the weight of a page load".                                                                                                                                                                                                                                                                                             |
| 2026-09-23                    | `a65f421`                     | "Measure the lead funnel instead of only its last step" — `form_view` / `form_start` / `form_error` / `form_submit` goals created. **No funnel-step data exists before this date.**                                                                                                                                            |
| 2026-09-24 10:34 +0800        | `fb8f1da`                     | "Put the lead form back within reach on a phone" — mobile form moved from 7507 px back to 2428 px.                                                                                                                                                                                                                             |
| 2026-09-24 11:21 +0800        | `d9716d5`                     | "Turn a messenger tap into a brief instead of an anonymous click" — messenger tiles start opening the lead modal.                                                                                                                                                                                                              |
| 2026-09-24 12:01 +0800        | `33eaa23`                     | "Ask only for a contact, and put it first in the lead form" — `name` stops being required, contact field moves first.                                                                                                                                                                                                          |
| 2026-09-29 14:05Z             | issues 44–60                  | the CRO audit lands in the tracker as 17 issues in one batch.                                                                                                                                                                                                                                                                  |
| 2026-10-02 02:44Z             | issue #56 closed              | messenger tiles go back to opening the messenger (ADR 0015 amended).                                                                                                                                                                                                                                                           |

### Where the light theme actually died

Walking every commit that touched `global.css` and printing `--color-bg` and whether
a `data-theme` block exists: [P]

```
2026-09-13 527ba41 bg=[--color-bg: #f4f6fa;] data-theme=1  :: Animate the modals and give case prose room to breathe
2026-09-14 5a9ee8d bg=[--color-bg: #0a0b0c;] data-theme=0  :: Fill out the service pages and give them their own photography
```

One commit, no intermediate step. The commit also wrote the intent into the file,
where it still sits at HEAD (`apps/approved-rs/src/styles/global.css:136-139`):

> One theme, deliberately dark: the pages are carried by photographs of delivered
> cars, and a light ground washes them out. There is no light variant and no toggle.

There is **no ADR for that decision** — issue #96 (2026-10-02, "Research a lighter
palette for approved.rs before repainting") says so explicitly, and `ls docs/adr/`
confirms: 0001–0029, none about palette or hero imagery. [P]

---

## 2. Before/after deltas, enumerated

Diff base: `527ba41` (2026-09-13, last light commit) → `5a9ee8d` (2026-09-14, the
flip) → `main` at `f6ad14f` (2026-10-02). All [P].

### 2.1 Theme tokens

`apps/approved-rs/src/styles/global.css`, `@theme` block:

| token                   | light (`527ba41`)                      | dark (`5a9ee8d`)                      | HEAD           |
| ----------------------- | -------------------------------------- | ------------------------------------- | -------------- |
| `--color-bg`            | `#f4f6fa`                              | `#0a0b0c`                             | `#0a0b0c`      |
| `--color-surface`       | `#ffffff`                              | `#161a1c`                             | `#161a1c`      |
| `--color-text`          | `#0d0f14`                              | `#f5f3ef`                             | `#f5f3ef`      |
| `--color-text-2`        | `#2d3448`                              | `#c8cbca`                             | `#c8cbca`      |
| `--color-muted`         | `#6b7280`                              | `#8d9493`                             | `#8d9493`      |
| `--color-accent`        | `#1e3a5f` (navy)                       | `#d8452b` (red)                       | `#ef6247`      |
| `--color-accent-strong` | —                                      | —                                     | `#c8381f`      |
| `--color-on-accent`     | `#ffffff`                              | `#ffffff`                             | `#ffffff`      |
| `--color-border`        | `#d8dce8`                              | `#2a3033`                             | `#2a3033`      |
| `--font-display`        | `'Playfair Display', Georgia, serif`   | `'Unbounded', system-ui, sans-serif`  | `'Unbounded'`  |
| `--font-sans`           | `'Outfit', system-ui, sans-serif`      | `'Golos Text', system-ui, sans-serif` | `'Golos Text'` |
| dark override block     | `[data-theme='dark'] { … }`, 28 tokens | **deleted**                           | absent         |
| `--color-stamp-ink`     | `#b23a2e`                              | **deleted**                           | absent         |

`BaseLayout.astro` in the same commit deleted the whole FOUC script —

```diff
-    <!-- Prevent flash of wrong theme: explicit choice wins, otherwise follow OS preference. -->
-    <script is:inline>
-      try {
-        const stored = localStorage.getItem('theme');
-        const wantsDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
-        if (wantsDark) document.documentElement.setAttribute('data-theme', 'dark');
-        else document.documentElement.removeAttribute('data-theme');
-      } catch (e) {}
-    </script>
```

— and replaced it with two meta tags:

```diff
+    <meta name="color-scheme" content="dark" />
+    <meta name="theme-color" content="#0a0b0c" />
```

The `<Moon/>`/`<Sun/>` toggle button went out of `Header.astro` with it.

### 2.2 Contrast ratios, computed

WCAG 2.x relative-luminance formula, computed in this session. Thresholds: **4.5:1**
for normal text, **3:1** for large text (SC 1.4.3, W3C) and **3:1** for UI component
boundaries against adjacent colour (SC 1.4.11, W3C). [P]

| pair                                                  | light                            | dark 09-14..09-21                                 | dark HEAD                       |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------- | ------------------------------- |
| primary CTA label on its ground (`#ffffff` on accent) | **11.50:1**                      | **4.37:1 — fails 1.4.3**                          | **5.20:1**                      |
| primary CTA ground vs page ground                     | **10.63:1**                      | 4.51:1                                            | **3.79:1**                      |
| body text on page                                     | 17.72:1                          | 17.77:1                                           | 17.77:1                         |
| secondary text on page                                | 11.44:1                          | 12.05:1                                           | 12.05:1                         |
| muted text on page                                    | 4.47:1 (marginal fail)           | 6.37:1                                            | 6.37:1                          |
| accent _text_ on page                                 | 10.63:1                          | **4.51:1**                                        | 6.10:1                          |
| accent text on a card surface                         | 11.50:1 (`#1e3a5f` on `#ffffff`) | **4.01:1 — fails 1.4.3** (`#d8452b` on `#161a1c`) | 5.43:1 (`#ef6247` on `#161a1c`) |
| card surface vs page (card edge)                      | 1.08:1                           | 1.12:1                                            | 1.12:1                          |
| border vs page                                        | 1.27:1                           | 1.47:1                                            | 1.47:1                          |

Reading of this table:

- The **primary CTA lost 7 points of contrast**, from 11.50:1 to 4.37:1, and for the
  week of 2026-09-14..09-21 the button label did not meet SC 1.4.3 for normal text.
  `cb8e25a` (2026-09-21) fixed the label (5.20:1) by darkening the ground, which cost
  the _button-vs-page_ ratio: **3.79:1**, now only 0.79 above the 1.4.11 floor. In the
  light theme the button stood 10.63:1 clear of the page. On a dark page a red button
  is a far weaker visual target than a navy button on near-white.
- Body and secondary text are _better_ in dark. The palette is not broadly
  inaccessible; the regression is concentrated in the one element that has to be
  pressed.
- Cards and borders are near-invisible against the ground in **both** themes (1.08:1
  and 1.12:1). That is not a change.

### 2.3 Hero: from drawing to photograph

|                              | light (`527ba41`)                                                                                                                   | dark (`5a9ee8d`)                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hero section class           | `.hero-grid` — a 48 px CSS grid-line background plus two radial gradients                                                           | `.photo-hero` — a photograph with a gradient veil                                                                                                                                                                        |
| hero image                   | **none** (`src/assets/hero-delivery.jpg` does not exist at this SHA)                                                                | `hero-delivery.jpg`, 2000×1500, **654 990 bytes**, `loading="eager" fetchpriority="high"` → it is the LCP element                                                                                                        |
| `h1` third line              | `<em class="text-accent italic">Одобрено.</em>` plus an inline SVG "ПРОВЕРЕНО · ОДОБРЕНО" ink stamp with a tick, 59 lines of markup | `<span class="block text-accent">Доставлено.</span>`, stamp deleted                                                                                                                                                      |
| above the headline           | `<span class="eyebrow">{h.heroEyebrow}</span>`                                                                                      | a `.hero-tag` link to a real case: car · country · price · "передан клиенту" (removed again by `59faa8d`, 2026-09-15)                                                                                                    |
| mobile hero layout           | text first, no image in flow                                                                                                        | `.photo-hero-shot` is a **static block** below 1024 px, so the photo sits above the headline and pushes it down; `aspect-ratio: 21/9` only from 640 px, `min-height: min(88vh, 46rem)` only from 1024 px                 |
| total new source photography | —                                                                                                                                   | **2 346 691 bytes** across 7 JPEGs (`hero-delivery` 654 990, `service-buyback` 388 895, `service-inspection` 320 128, `service-sourcing` 285 070, `closing` 280 147, `service-import` 225 288, `inspection-car` 192 173) |

The CRO audit measured the result on a phone: "a photo takes up about 60% of the
first screen, the H1 sits at its lower edge, and the subheading and CTA are below the
fold" (issue #53, 2026-09-29). [S] `cb8e25a` (2026-09-21) separately recorded that
PageSpeed found "a hero served two size steps larger than it renders". [S]
Actual LCP numbers for the site before and after: **[NOT ESTABLISHED]** — there is no
stored CrUX or Lighthouse history in the repo. What would answer it: a PageSpeed
Insights / CrUX history query for `approved.rs` covering 2026-08 through 2026-10.

### 2.4 The lead form: position, fields, doors

`apps/approved-rs/src/pages/[locale]/index.astro`. Desktop is unchanged — the form
sits in the hero sidebar under `hidden lg:block` in both versions. **Mobile is where
it moved.**

|                                      | light (`527ba41`)                                                                                | dark (`5a9ee8d`)                                                                                                                                                            | HEAD                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| mobile section order before the form | quick-links band → hero → Journey (services + process + country strip)                           | quick-links band → photo-hero → Journey → «Откуда возим» → «Что берут на эти деньги» (CaseCatalogue) → «Сто пунктов» (InspectionMap) → «Почему выбирают нас» → testimonials | restored to after Journey                                                        |
| sections ahead of the form, mobile   | **1**                                                                                            | **6**                                                                                                                                                                       | 1                                                                                |
| measured offset                      | **2428 px, third screen**                                                                        | **7507 px down a 10320 px page, tenth screen**                                                                                                                              | ~2413 px (issue #53)                                                             |
| source                               | `fb8f1da` commit body [S]                                                                        | `fb8f1da` commit body [S]                                                                                                                                                   | issue #53 [S]                                                                    |
| fields, in order                     | `name` (**`required`**) → contact (tabbed telegram/whatsapp/viber/phone) → `comment` → `consent` | same                                                                                                                                                                        | **contact first**, `name` optional, `comment`, `consent` (`33eaa23`, 2026-09-24) |
| mobile traffic share this applies to | 92% [S] / 92.2% measured pre-period [P]                                                          |                                                                                                                                                                             | 84% [S] (issue #52)                                                              |

Doors into the form, counted from the markup at each SHA. Unchanged by the repaint:
header CTA button (`DATA_OPEN_LEAD_MODAL`, label `Заявка` / `Оставить заявку` —
**identical copy** in `dictionary.yaml` at both SHAs), the callback control inside
`ContactCTA` (`callbackButtonLabel: Заказать звонок`, unchanged), the inline form, the
bottom CTA block, and `FloatingContactWidget` (present in `BaseLayout.astro` at
`527ba41`, `5a9ee8d` and HEAD alike). Messenger tile labels (`Написать в Telegram`,
`…WhatsApp`, `…Viber`, `Позвонить`) are **byte-identical** across the repaint. [P]

**So: button copy did not change.** The only user-visible copy change in the hero is
`Одобрено.` → `Доставлено.` plus the loss of the stamp seal. [P]

The messenger-tile detour that the CRO audit later priced was **not** introduced by
the repaint: on the homepage at `527ba41`, `ContactCTA`'s `openModal` prop defaults to
`false`, so the tiles already carried their real messenger `href`. The detour was
added on **2026-09-24** (`d9716d5`) and removed on **2026-10-02** (issue #56). It is a
confound for anything measured after 09-24, never a cause of a 09-15 change. [P]

---

## 3. What the numbers show

Counter **111800377** (`docs/guides/deploy.md`). Exclusions applied as required.
Pre = 2026-08-15..09-14 (**116 sessions**), post = 2026-09-15..10-01 (**163
sessions**). "reaches" = goal completions; "visits" = sessions with ≥1 completion;
CR = visits-with-goal ÷ sessions. [P]

| metric                           | pre reaches | pre visits | pre CR | post reaches | post visits | post CR |
| -------------------------------- | ----------- | ---------- | ------ | ------------ | ----------- | ------- |
| thanks page (URL goal)           | 9           | 9          | 7.76%  | 10           | 5           | 3.07%   |
| auto "form submission"           | 6           | 6          | 5.17%  | 8            | 5           | 3.07%   |
| auto "messenger"                 | 7           | 5          | 4.31%  | 11           | 7           | 4.29%   |
| auto "phone click"               | 0           | 0          | 0.00%  | 9            | 7           | 4.29%   |
| `contact_click`                  | 12          | 8          | 6.90%  | 26           | 13          | 7.98%   |
| `lead_modal_open`                | 7           | 6          | 5.17%  | 14           | 12          | 7.36%   |
| interest (service/case URL goal) | 62          | 28         | 24.14% | 107          | 48          | 29.45%  |
| `form_view`                      | 0           | —          | —      | 76           | 48          | 29.45%  |
| `form_start`                     | 0           | —          | —      | 3            | 3           | 1.84%   |
| `form_submit`                    | 0           | —          | —      | 3            | 3           | 1.84%   |
| `scroll_50`                      | 0           | —          | —      | 42           | 28          | 17.18%  |

Engagement, same split: pageviews/visit **3.19 → 2.15**, median duration **29 s → 19
s**, bounce **14.7% → 30.7%**. [P]

Mix:

|          | pre         | post           |
| -------- | ----------- | -------------- |
| direct   | 57 (49.1%)  | 75 (46.0%)     |
| social   | 7 (6.0%)    | **45 (27.6%)** |
| internal | 36 (31.0%)  | 12 (7.4%)      |
| organic  | 14 (12.1%)  | 29 (17.8%)     |
| mobile   | 107 (92.2%) | 127 (77.9%)    |
| desktop  | 9 (7.8%)    | **34 (20.9%)** |

### 3.1 Read this table carefully, because four of its rows are traps

- **`form_view` / `form_start` / `form_submit` / `form_error` / `scroll_*` cannot be
  compared.** Those goals were created on 2026-09-23 (`a65f421`). Zero before that is
  a definition, not a drop. Issue #54 says the same: "the form-step goals only start
  on 24.09, so there is no data to draw conclusions from". [P][S]
- **The auto phone-click goal has the same problem** — first data 2026-09-16, per the
  changelog in `docs/guides/analytics.md`. The `0 → 9` is partly goal creation. [P]
- **`contact_click` conflated modal opens with messenger taps** until issue #92 landed
  on 2026-10-02. [S] Its `12 → 26` is not a clean behavioural signal.
- **Only two rows survive the date cleanly**: the thanks-page URL goal and Metrica's
  own automatic form-submission goal. Both are flat-to-up in absolute terms (9→10,
  6→8 reaches) and both halve as a rate.

### 3.2 Why the rate halved: the denominator changed on the same day

`3d1283a` (2026-09-14 21:54 +0800) switched approved.rs analytics from **opt-in to
opt-out**. The removed code in `CookieConsent.astro` at `527ba41` was:

```js
const stored = readConsent(version);
if (stored) {
  if (stored.analytics) window.loadAnalytics?.();
} else {
  open();
}
```

— no stored answer meant **no counter at all**. What replaced it, now at
`packages/site-kit/src/analytics.ts:88`, is `if (!refused()) start();`, with
`analyticsDeclined` returning `false` for a missing or unparseable value. `ADR 0012`
records the decision in its title: "Yandex Metrica only, started before the consent
answer … the counter starts before the cookie-banner answer and only an explicit
refusal stops it … This is deliberate." [P]

Consequences, all of which point the same way:

- The pre-period sample is **self-selected toward engaged visitors** — only people who
  bothered to click Accept were ever counted. That alone explains 3.19 pageviews and
  14.7% bounce before versus 2.15 and 30.7% after, and it inflates every pre-period
  conversion rate.
- There is **no step down in sessions** at 2026-09-14/15 in either the filtered or the
  unfiltered series. Filtered sessions step _up_ (weekly: 4, 23, 31, 36, 59, 65, 61)
  and desktop share triples, which is what a counter that newly starts for everyone
  looks like. [P]
- The unfiltered series falls (224 → 193 visits) but moves in the **opposite
  direction** to the filtered one, because 124 of 417 raw sessions were the owners'
  and the partner's and they were concentrated in the pre-period (`internal` traffic
  44 → 9 unfiltered). Any pre/post read off the unfiltered numbers has the wrong
  sign. This is exactly what `analytics-exclusions.md` exists to prevent. [P]

**Therefore: the Metrica data does not support causality, and it does not support the
premise either.** The pre/post conversion-rate comparison is invalid, and the two
valid absolute counts did not fall.

### 3.3 The lead store, which would settle it, is unreachable

`data/leads.json` on Vercel Blob is ground truth. It cannot be read from this
machine. `BLOB_READ_WRITE_TOKEN` is present only as a placeholder in
`apps/approved-rs/.env.example` and absent from every real `.env*`. No read-only dump
script exists anywhere in `scripts/` or `.github/scripts/`. The only local
`leads.json` files are gitignored dev scratch: 2 records in
`apps/approved-rs/.local-data/data/leads.json` (both dated 2026-10-02, localhost) and
2 in `apps/auto-service/.local-data/` from the shop funnel walk. **Zero records exist
locally in the 2026-08-15..2026-09-30 window.** [P]

What would answer it: the `BLOB_READ_WRITE_TOKEN` from the approved.rs Vercel project
env, then a read-only `head`/`get` of `data/leads.json`, counted per day and split by
`brand` and `source_url`. Nothing on disk substitutes for it.

Two second-hand figures do exist, both [S]:

- Issue #60 (CRO audit): "261 visits over 40 days (~6.5 a day), 189 users. Conversion
  to contact is ~13% … Google organic: 33 visits → 7 enquiries. Direct hits on `/`:
  105 visits → 1 enquiry. Threads (29 visits from 5 people), Instagram, ChatGPT — 0
  enquiries", and "which of the **12 enquiries** became clients".
- `fb8f1da` (2026-09-24): "Over a month of clean traffic (own browsers and Russia
  excluded) 189 visits produced 13 form opens and 8 submissions — once the form is
  open it converts at 62%, but only 7% of visitors ever reach it. Meanwhile the
  channel shifted: form submissions went 6 → 2 across the split while phone clicks
  went 0 → 5, and a click arrives with no name, model or budget attached, which is
  why a month of more traffic and better conversion still felt like silence."

That last sentence is the best available account of the owner's experience, written by
whoever was in the code at the time, and it is a **channel-mix** explanation, not a
volume one. It is corroborated by `d9716d5`'s lead-store count: "Of 24 such
[contact-click] leads, 12 were never touched and none became a deal; of 10 form
leads, 6 progressed and one closed." [S]

### 3.4 No archive, no contemporaneous ticket

- **The Wayback Machine has never captured approved.rs.** Availability API returns
  `"archived_snapshots": {}` for timestamps 20260801, 20260901, 20260910, 20260915,
  20260920 and 20261001; the CDX index returns `[]` for both `approved.rs` and
  `approved.rs*`; `https://web.archive.org/web/20260915/https://approved.rs/` returns
  HTTP 404. So no claim about what the live page looked like on either side of
  2026-09-15 can be sourced from the archive — only from the working tree at the SHAs
  above. [P]
- **The tracker cannot document September.** `Zikrasoft/approved_rs` holds 59 issues,
  numbers 35–99, and the earliest `createdAt` in the whole tracker is
  **2026-09-29T14:05:19Z**. Numbers 1–34 are pull requests. There is no issue about a
  lead drop, and the only theme issue (#96) is dated 2026-10-02. [P]
- **The pasted link is a mis-paste.** `Zikrasoft/teacher-assistant#53` is "Redesign
  the web app as a clean, modern work tool", a different product; it has nothing to do
  with approved.rs. The intended issue is almost certainly `Zikrasoft/approved_rs#53`,
  "The mobile form on the homepage sits at ~2413 px". [P]
- **The CRO audit itself is external**, cited verbatim at the foot of issues 44–60:
  `Source: CRO audit of approved.rs (2026-09-29) — https://claude.ai/artifact/Af1MxS8ejebQ4p7Dgc19ru`. [P]

---

## 3a. The lead store, read directly — the question is now settled

Added 2026-10-02, after the owner supplied the production blob. Source: `data/leads.json`
pulled from the approved.rs Vercel Blob store, 34 307 bytes, 44 records,
`createdAt` spanning **2026-09-03T06:25:17Z .. 2026-10-01T13:59:47Z**. Two records are
test traffic (`id` 1 `"Test"`, `id` 39 `"TEST Claude — удалить"`) and are excluded; the
six `brand: "CarLab"` records are a different site whose first lead is
2026-09-16T12:10:55Z, after the repaint, so they cannot appear on both sides and are
excluded too. That leaves **36 Approved.rs leads**. Split at the deploy, 2026-09-14
17:12:01Z. [P]

| cohort                | pre (11.4 d) | rate   | post (16.9 d) | rate   | delta    | p    |
| --------------------- | ------------ | ------ | ------------- | ------ | -------- | ---- |
| all Approved.rs leads | 18           | 1.57/d | 18            | 1.07/d | **−32%** | 0.31 |
| form submissions      | 7            | 0.61/d | 8             | 0.47/d | −22%     | 0.61 |
| contact clicks        | 11           | 0.96/d | 10            | 0.59/d | −38%     | 0.27 |

`p` is a two-sided exact binomial test on the post share of the pooled count, against
the null share the window lengths imply (16.9 ÷ 28.3 = 59.6%). Nothing here clears any
conventional threshold. [P]

**The entire gap is one day.** 2026-09-11 produced five leads, the highest single day
in the file and more than a quarter of the pre-period. Drop that one day and the
pre-period rate is **1.14/d against the post-period's 1.07/d** — a 6% difference, which
is noise. The "drop" the owner noticed is a good Friday in the before-window, not a
regime change after it. [P]

Three further readings of the same file:

- **Form leads barely moved at all** (−22%, p = 0.61). If a dark palette suppressed the
  will to act, the form is where it would show, and it is the cohort that moved least.
- **The biggest single-channel move is WhatsApp clicks, 4 → 1**, against Telegram 3 → 3
  and phone 4 → 6. A palette does not select a messenger; a contact-tile change does.
  This is worth tracing to the tile markup, not to the theme.
- **Status counts cannot be compared across the split.** The post-period holds 12 leads
  still at `new` against the pre-period's 2, because they have not been worked yet. The
  pre-period's 12 `lost` and 1 `won` describe elapsed sales time, not lead quality, and
  the `dealAmount` totals (250 pre, 0 post) say the same thing. Do not read conversion
  quality off this file for at least another two weeks. [P]

### 3a.1 Splitting the post-period at the form fix — the one real signal

The post-period is not homogeneous: the mobile form sat at 7507 px from the repaint
until `fb8f1da` (2026-09-24), and at 2428 px after it. The palette is identical across
that boundary, so splitting there isolates form position from colour. [P]

| window                     | days | all leads | /day | form submissions | /day     |
| -------------------------- | ---- | --------- | ---- | ---------------- | -------- |
| light theme (09-03..09-14) | 11.4 | 18        | 1.57 | 7                | 0.61     |
| dark, form at 7507 px      | 9.3  | 11        | 1.18 | 1                | **0.11** |
| dark, form at 2428 px      | 7.6  | 6         | 0.79 | 6                | **0.92** |

Broken vs fixed, form submissions only: **1 vs 7, exact binomial p = 0.03**. The same
split on all leads is 11 vs 7, p = 0.64 — noise. [P]

This is the only result in the dataset that clears a conventional threshold, and it
separates the two hypotheses cleanly: the palette is constant across the boundary and
the position is not. Nine days with the form on the tenth screen produced **one**
submission; seven and a half days with it on the third screen produced **seven**.

It also inverts the premise of the question. The dark theme with the form in place
yields **0.92 form submissions/day against the light theme's 0.61** — higher than
before the repaint. On this evidence the repaint did not cost leads; the section
reorder that shipped inside the same commit did, for the ten days it was live.

Three caveats, stated so the number is not over-read: n = 1 and n = 7 are small; the
windows are 9.3 and 7.6 days; and this is one test among several run over the same
file, so p = 0.03 overstates the confidence a pre-registered test would carry. What
earns it weight is not the p-value but the agreement with an independently measured
mechanism — `form_view` says 29.45% of sessions see the form, and `fb8f1da` measured
62% conversion once it is open. [P][S]

The total-lead fall from 1.18 to 0.79/d across the fix is contact clicks, not forms,
and is exactly the trade the fix was meant to make: fewer nameless clicks, more
answerable leads.

**What this file cannot answer.** It begins 2026-09-03, eleven days before the repaint,
so there is no August baseline and no way to know whether 1.57/d was itself normal. A
single five-lead day inside an eleven-day window is enough to set the whole comparison,
which is the definition of an underpowered one. [P]

**Consequence for the verdict.** The Metrica reading in §3 and the CRM reading here
agree: there is **no evidence of a lead drop caused by the repaint**, and the apparent
drop in rate seen in Metrica is the opt-in → opt-out analytics switch of `3d1283a` on
the same day, not behaviour. §3a.1 goes further and names what did cost leads — the
mobile form position, already fixed in `fb8f1da` on 2026-09-24 and still correct at
HEAD (`apps/approved-rs/src/pages/[locale]/index.astro:203`). [P]

---

## 4. Confounds, all of them

Anything on this list makes a before/after read of 2026-09-15 less than clean. Dated,
with its commit or issue.

**Measurement**

1. **Analytics opt-in → opt-out**, `3d1283a`, 2026-09-14 — the single largest
   confound. Pre-period sessions are a self-selected engaged subset; post-period are
   everyone. Invalidates every pre/post _rate_. [P]
2. **Funnel-step goals created 2026-09-23**, `a65f421` — `form_view`, `form_start`,
   `form_error`, `form_submit` have no pre-period at all. [P]
3. **Auto phone-click goal created 2026-09-16** — its `0 → 9` is partly goal creation. [P]
4. **`form_submit` fired on attempt, not acceptance**, and **`contact_click` counted
   modal opens**, until 2026-10-02 (`cb8d79a`, issues #54/#92). [S]
5. **GA4 removed and Metrica deferred to idle-after-`load`**, `cb8e25a`, 2026-09-21 —
   a counter that starts later loses the shortest sessions. [P]
6. **`COOKIE_POLICY_VERSION` bumped**, `19a0954`, 2026-09-15 — re-prompts consent for
   every returning visitor, so some previously-counted visitors drop out until they
   answer again. [P]
7. **Metrica counters added for the two brand sites**, `19a0954`, 2026-09-15 — traffic
   that used to be approved.rs's is now someone else's counter.

**Traffic and inventory, not design**

8. **approved.rs lost two whole service verticals**, `b3f0f3c` + `2a2e747`,
   2026-09-12 — autoservice and detailing cases moved to carlab.rs and details.rs,
   and approved.rs 301s to them. Two days before the repaint. Any lead that used to
   arrive for those services now arrives on another domain, under another `brand`. [P]
9. **Traffic mix changed violently**: social 7 → 45 sessions (6.0% → 27.6%), internal
   36 → 12, desktop 9 → 34. Social traffic converts differently from direct and
   organic; issue #60's own split shows "Threads (29 visits from 5 people),
   Instagram, ChatGPT — 0 enquiries" against "Google organic: 33 visits → 7
   enquiries". A mix shift of this size changes conversion with no design cause. [P][S]
10. **Ad spend, posting cadence, Telegram-channel activity and seasonality**:
    **[NOT ESTABLISHED]**. Nothing in the repo records them. What would answer it:
    the owner's own ad-platform billing and posting history for 2026-08 and 2026-09.
11. **Deploy gaps.** CI runs for `8050767`, `45027c0`, `4c880cb`, `582d464`,
    `5704284`, `bcef0bb` all **failed** between 2026-09-14T15:33Z and 17:00Z, and
    `deploy` is downstream of `translate`, so production lagged main in bursts. From
    `870aa53` (2026-09-16) deploys are filtered by `refs/tags/deployed/<app>`, so the
    historical deploy times are not recoverable from the tag — it now points at
    `8b569e0` (2026-10-02) for all three sites. [P]

**Funnel changes on this same branch and in this same period**

12. **Mobile form at 7507 px for ten days**, `5a9ee8d` 2026-09-14 → `fb8f1da`
    2026-09-24. The one unambiguous regression in the repaint. [S]
13. **Service picker removed and `name` made optional**, `33eaa23` 2026-09-24,
    ADR 0015 — changes what a submission costs the visitor. [P]
14. **Messenger tiles started opening the form**, `d9716d5` 2026-09-24, then stopped
    again, issue #56 closed 2026-10-02 — a round trip inside the measurement window. [P]
15. **`tel:` controls hidden on a fine pointer**, `5e66c7b`/`019b28a` 2026-10-02,
    issue #92 — removes a control from 21% of post-period sessions. [P]
16. **Cookie banner covering the H1 and the CTA on mobile**, issue #52 — open from
    2026-09-29 and unfixed through the window; the banner's behaviour was changed on
    2026-09-16 (`180322d`) and again on 2026-10-02 (`98b39f9`, `0969357`). [P][S]
17. **Geo-suggestion banner deleted**, `180322d` 2026-09-16. [P]
18. **Language-offer banner added**, `12d9106` 2026-09-22 — 50 `lang_offer_shown`
    reaches in the post period, i.e. an extra interstitial for a fifth of sessions. [P]
19. **Locale routing fixed**, `f80a83c` 2026-09-14 "Stop serving Russian on every
    non-Russian page" — changes which language a visitor lands in. [P]
20. **Known submission blockers live through the whole window**: issue #45 (country
    select opens at `selectedIndex=-1` for the Europe/Sarajevo and Europe/Istanbul
    timezones — i.e. Bosnian and Turkish visitors) and issue #46 (a failed submission
    returns bare text and loses what was typed). Both still open. [S]

---

## 5. Context from published research

Short, and deliberately separate: this is background on the mechanisms, **not**
evidence about this site.

- **Light mode beats dark mode for reading, for most people.** Nielsen Norman Group's
  research summary (Raluca Budiu, _Dark Mode vs. Light Mode: Which Is Better?_,
  nngroup.com/articles/dark-mode/) reports that in Piepenbrock et al. (2013) "light
  mode won across all dimensions" on visual-acuity and proofreading tasks regardless
  of age, and that "the positive-polarity advantage increased linearly as the font
  size was decreased". The mechanism given is pupil contraction: "the pupil contracts
  more. As a result, there are fewer spherical aberrations, greater depth of field."
  The exception is users with cloudy ocular media — Legge et al. (1985) found
  "participants with cloudy ocular media had better reading rates with dark modes" —
  and Dobres et al. (2017) found no significant polarity effect in daylight, with
  light mode ahead at night. **This is about reading legibility, not about conversion,
  and NN/g does not claim a conversion effect.** No first-party source found in this
  session measures dark-vs-light on lead conversion.
- **Contrast is a standard, not an opinion.** W3C WCAG 2.2 Understanding SC 1.4.3:
  text needs "a contrast ratio of at least 4.5:1", large text 3:1. SC 1.4.11: user
  interface components need "a contrast ratio of at least 3:1 against adjacent
  color(s)", and the 3:1 figure is "intended to be treated as threshold values" with
  no rounding — 2.999:1 fails. Against those: the 2026-09-14..09-21 CTA label at
  4.37:1 **failed** 1.4.3, and HEAD's button ground at 3.79:1 against the page clears
  1.4.11 by 0.79.
- **Decorative photography is ignored; informative photography is not.** Jakob
  Nielsen, _Photos as Web Content_ (nngroup.com, 2010-10-31, last reviewed
  2026-08-13), from eyetracking: "Users pay attention to information-carrying images
  that show content that's relevant to the task at hand. And users ignore purely
  decorative images", and specifically users "ignore stock photos of generic people"
  and "big feel-good images that are purely decorative". This is directly on point:
  `5a9ee8d` recorded the service heroes and the closing band as **licensed stock**
  (`src/assets/SOURCES.md`), and `59faa8d` (2026-09-15) replaced the hero with another
  stock shot and deleted the caption that had tied it to a real delivered car — moving
  the hero from the informative category into the decorative one, in Nielsen's terms.
- **A heavy eager hero is an LCP risk.** web.dev, _Largest Contentful Paint (LCP)_:
  "sites should strive to have Largest Contentful Paint of 2.5 seconds or less",
  measured at "the 75th percentile", and `<img>` elements are explicit LCP candidates.
  The repaint made a 654 990-byte JPEG the homepage's `fetchpriority="high"` eager
  image; `cb8e25a` later recorded that it had been "served two size steps larger than
  it renders".

---

## 6. Answers to the three questions asked

**Is the drop causal?** **Inconclusive, leaning no.** The two lead signals that can be
compared across 2026-09-15 did not fall in absolute terms (9→10 and 6→8 reaches). The
rate fell by half, but the denominator changed on the same day for a measurement
reason that works in exactly that direction, and the traffic mix changed violently
(social 7→45 sessions) in the same period. Total `form_submit` observations in the
whole window: **3**. No causal claim is defensible at that n, and `#60` says so about
this site in general: "A/B tests are statistically impossible at ~190 users a month".

**What exactly changed?** §2. One commit (`5a9ee8d`) carried the palette, the
typefaces, the accent colour, the loss of the theme toggle, the first hero photograph
and — as a side effect of six new homepage sections — the mobile lead form's fall from
the third screen to the tenth. Button copy did not change. The hero headline changed
one word and lost its "ПРОВЕРЕНО · ОДОБРЕНО" ink stamp.

**What in the old design was driving action?** Three things the repaint removed, in
descending order of how well the evidence supports them:

1. **The mobile form was within reach.** 2428 px, the third screen, on 92% of traffic.
   After: 7507 px of 10320. The repo measured both numbers and reversed the change
   ten days later. This is the strongest claim on the list. [S]
2. **The primary CTA was a high-contrast target.** Navy on near-white, 10.63:1 against
   the page and 11.50:1 for its label. Now 3.79:1 and 5.20:1. A button you have to
   look for is a button fewer people press. Computed here; not measured on this site.
3. **The hero made a verifiable claim.** `Одобрено.` with an inspection stamp, and —
   briefly, 2026-09-14 to 09-15 — a hero tag naming a real car, its country and its
   price. Both are gone, replaced by a stock photograph with no caption. NN/g's
   eyetracking says a decorative stock image is ignored; it does not say this costs
   leads on this site.

What is **not** supported as a cause: the dark palette per se. Body and secondary text
contrast _improved_. The one defensible palette complaint is the CTA, and the CTA is
fixable without repainting the site.

---

## 7. What to do next, in order

1. **Read the lead store.** Everything above is a proxy for the one dataset that
   **Done, 2026-10-02 — see §3a.** The owner supplied the blob. Result: −32% at
   p = 0.31, entirely attributable to one five-lead day on 2026-09-11; form leads
   −22% at p = 0.61. The repaint is exonerated by the data that exists. What remains
   open is the **WhatsApp contact-click move, 4 → 1** against Telegram 3 → 3 and
   phone 4 → 6 — a palette does not select a messenger, so trace that to the contact
   tile markup. And re-read this file around 2026-10-16: 12 post-period leads are
   still at `new`, so lead _quality_ is not yet comparable across the split.
2. **Fix the CTA contrast without repainting.** The button ground at 3.79:1 against
   the page is the one measured accessibility regression still live at HEAD. A lighter
   ground or a visible border buys back target salience at the cost of nothing. This
   is the change with the best evidence-to-effort ratio.
3. **Run issue #53's experiment (E5): the form immediately after the hero on mobile.**
   The form is back at 2413 px, which is better than 7507 but still the third screen;
   `form_view` says 29.45% of post-period sessions see the form at all, and `fb8f1da`
   measured 62% conversion once it is open. Moving it up is the only lever that acts
   on the measured bottleneck rather than on a hypothesis.

Do **not** repaint light as the first move. Issue #96 already asks for that research
and nothing here justifies it ahead of (1)–(3): the palette change is confounded with
five other changes in the same 48 hours, two of which are measurement artefacts, and
one of which (the mobile form) has a measured number attached and has already been
reversed once.

If the palette is tested anyway, test it **sequentially, four weeks against four
weeks** — issue #60's own recommendation at this traffic level — and only after the
funnel-step goals have a clean baseline, i.e. no earlier than four weeks after
2026-10-02, since `form_submit` and `contact_click` both changed meaning on that date.
