# How many CTAs belong in approved.rs's hero?

Research date: **2026-10-02**. Question from the owner: the hero stacks three calls
to action on a phone — a filled «Написать в Telegram», and under it two outlined
controls, «Заказать проверку» (opens the lead-form modal) and «Позвонить» (a `tel:`
link, coarse pointers only). Does offering three confuse the visitor and cost
conversions? What is the defensible number, and how should they be ranked?

## Source status

Tags used below, same convention as `white-vs-dark-theme-lead-drop.md` and
`serbia-online-shop-legal.md`:

- **[P]** — primary source read directly in this session: the text of a paper
  (PDF opened and read, not summarised through a blog), the text of a standard, a
  file or commit object in this repository, or a vendor's own guidance page.
- **[S]** — secondary: a summary, a commit message or an issue body asserting
  something whose underlying data was not re-pulled here.
- **[NOT ESTABLISHED]** — could not be verified from any available source.

No number in this file was estimated. Where an arithmetic result appears (the
sample-size calculations in §10) the formula and the inputs are given so it can be
recomputed.

---

## Verdict first

1. **"Three CTAs confuse people" is not supported by the research it is usually
   attributed to.** The choice-overload literature compares assortments averaging
   **7 options against 34** (Scheibehenne, Greifeneder & Todd 2010) and **4 vs 12 /
   8 vs 34** (Chernev, Böckenholt & Goodman 2015). Three buttons is smaller than the
   _small_ arm of every experiment in both meta-analyses. Nothing in that literature
   speaks to the difference between two buttons and three. [P]

2. **Even at the set sizes it does study, the effect does not replicate as a general
   law.** Scheibehenne et al. 2010, 63 conditions, 50 experiments, N = 5,036: mean
   effect size **d = 0.02**. Chernev et al. 2015, 99 observations, N = 7,202: without
   their four moderators the mean effect is **nonsignificant, t(20) = −0.10, p =
   .48** — they say so themselves, agreeing with Scheibehenne on that point. [P]

3. **Hick's law does not justify "fewer buttons" either, and the only peer-reviewed
   paper to examine the question says it argues the opposite.** Liu, Gori, Rioul,
   Beaudouin-Lafon & Guiard, CHI 2020: _"Hick's law speaks against, not for, the
   popular principle that 'less is better'."_ Because reaction time grows with the
   _log_ of the option count, splitting a set costs more total time than showing it
   at once. [P]

4. **So the real risk in this hero is not the number three. It is that three
   controls of similar visual weight do not tell the visitor which one you want them
   to press** — and that the one the business actually wants is, in the version the
   owner is describing, the _least_ prominent of the three. That is the part
   practitioner research (NN/g, Baymard) does address, and the part this repo's own
   lead data decides. [P]

5. **The hero is also offering one thing through three channels, not three different
   things.** No source found in this session tests that distinction directly
   (§7) — but the preconditions both meta-analyses name (no dominant option, no
   prior preference, hard-to-compare alternatives) are the opposite of what a
   Telegram / form / phone row looks like to a person who already has a preferred
   way to get in touch. That is an argument from the stated preconditions, not from
   a study of channel pickers. Treat it as reasoning, not as evidence.

6. **Tap targets are fine.** At 390 px the three stacked buttons are 44–46 CSS px
   tall with 12 px gaps — they pass WCAG 2.2 SC 2.5.8 (AA, 24×24) _and_ SC 2.5.5
   (AAA, 44×44), and meet Apple's 44 pt rule. They sit 2–4 px under Android's 48 dp
   recommendation. There is no mis-tap hazard here worth a design change. [P] (§9)

7. **An A/B test cannot settle this on this site.** Detecting a 20% relative change
   in a ~2% session-to-lead rate needs roughly **42,000 sessions**; this site
   measured 116 sessions in 31 days and 163 in 17. That is 12–30 years. Say so
   plainly and decide from mechanism instead. (§10)

---

## 1. What the hero actually is, in the repo

Read at `HEAD = f6ad14f` and in the working tree on 2026-10-02. **The working tree
moved under this research while it was being written** — both states are recorded,
because the recommendation in §8 turns out to be the direction the working tree
already took. [P]

The hero CTA row is `ContactCTA` with `compact`
(`apps/approved-rs/src/components/ContactCTA.astro`), rendered from three places:
`src/pages/[locale]/index.astro:152` (homepage, no `label`),
`src/layouts/ServicePageLayout.astro:177` (service pages, with the page's
`ctaLabel`) and `src/pages/[locale]/cases/[slug].astro:208`. [P]

**At `HEAD` (the state the owner's question describes):**

| order | control                                                           | style              | what it does                                            | shown when                                                                                   |
| ----- | ----------------------------------------------------------------- | ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     | «Написать в Telegram» (`ctaButtonLabel`)                          | **filled primary** | direct `https://t.me/…` link, `target="_blank"`         | always                                                                                       |
| 2     | the page's `ctaLabel`, e.g. «Заказать проверку», «Подобрать авто» | outlined secondary | `data-open-lead-modal`, href falls back to `/contacts/` | only when a `label` prop is passed — i.e. **service and 404/thanks pages, not the homepage** |
| 3     | «Позвонить» (`callButtonLabel`)                                   | outlined secondary | `tel:`                                                  | `pointer-fine:hidden!` — coarse pointers only                                                |
| 4     | «Заказать звонок» (`callbackButtonLabel`)                         | outlined secondary | opens the callback form                                 | only when **no** `label`, and `pointer-coarse:hidden!` — fine pointers only                  |

So the three-stacked-buttons hero the question is about is the **service-page**
hero. The **homepage** hero at `HEAD` shows two on a phone (Telegram + Позвонить),
because `index.astro` passes no `label`. Worth saying out loud, because the fix for
one is not automatically the fix for the other. [P]

**In the working tree on 2026-10-02 (uncommitted), the hierarchy is already
inverted:** the lead-modal button is now the filled primary and carries
`label ?? t.header.ctaLong` (= «Оставить заявку»), `RegionalContactButton` is passed
`variant="secondary"`, and the `tel:` button is unchanged. The homepage hero
therefore now shows **three** on a phone, with the form first. [P]

Two side effects of that uncommitted change, noted because they were found while
verifying the hero and not because they are part of this question:

- The fine-pointer callback branch (`!label && callbackTrigger()`) **was deleted**.
  `AGENTS.md` states the rule it implemented: _"where the phone link is the only
  phone control, as in the compact hero without a `label`, a callback button takes
  its place carrying `callbackButtonLabel`."_ A desktop visitor now gets no phone
  control and no replacement in the compact hero. [P]
- The new primary carries `lg:hidden`, so from 1024 px up the hero's only CTA is an
  **outlined** Telegram button, with the filled one gone and the sidebar `LeadForm`
  carrying the conversion instead. Deliberate or not, at `lg+` the hero has no
  filled control. [P]

Other paths to the same offer that share the first screen on a phone: the header's
always-visible «Заявка» button (`Header.astro:80`, `h-9` = 36 px tall, also
`data-open-lead-modal`) and `FloatingContactWidget` from `BaseLayout.astro:159`. A
count of "CTAs in the fold" that stops at the hero row is undercounting. [P]

---

## 2. Iyengar & Lepper 2000 — read at the source, including the parts folklore drops

_When Choice Is Demotivating: Can One Desire Too Much of a Good Thing?_, Journal of
Personality and Social Psychology, 2000, Vol. 79, No. 6, 995–1006. PDF read
directly. [P]

Study 1, the jam study: a tasting booth at Draeger's in Menlo Park, two Saturdays,
two 5-hour periods, roughly **754 shoppers observed**. Of 386 customers present
while the 24-jam display was up, 242 encountered it; of 368 present for the 6-jam
display, 260 encountered it.

- **Attraction:** 60% (145/242) stopped at the extensive display vs 40% (104/260) at
  the limited one. χ²(1, N = 502) = 19.89, p < .001. More choice attracted _more_
  people.
- **Purchase:** "Nearly 30% (31) of the consumers in the limited-choice condition
  subsequently purchased a jar of Wilkin & Sons jam; in contrast, only 3% (4) of the
  consumers in the extensive-choice condition did so", χ²(1, N = 249) = 32.34,
  p < .0001.

The number everyone quotes — 30% vs 3% — rests on **35 purchases in total**. The
authors list their own limitations immediately afterwards: shoppers in the
limited condition may have believed the six jams were specially selected; the
24-jam display may have drawn curious passers-by while the 6-jam display drew
serious jam buyers; and shoppers in both conditions sampled fewer than two flavours
(1.50 vs 1.38, F(1, 245) = 0.83, ns), so the extensive group may simply have had no
time to form a preference. Study 2 (6 vs 30 essay topics, 197 Stanford
undergraduates, 70 vs 123 assigned) and Study 3 (chocolates) are the other two
legs. [P]

Note what the manipulation was: **6 vs 24 near-identical exotic jams**, chosen
deliberately so that no participant would have a prior preference — the authors
removed strawberry and raspberry from the set for exactly that reason. [P]

---

## 3. Scheibehenne, Greifeneder & Todd 2010 — the meta-analysis that found nothing

_Can There Ever Be Too Many Options? A Meta-Analytic Review of Choice Overload_,
Journal of Consumer Research, Vol. 37, October 2010, 409–425. PDF read
directly. [P]

Abstract, verbatim: _"In a meta-analysis of 63 conditions from 50 published and
unpublished experiments (N = 5,036), we found a mean effect size of virtually zero
but considerable variance between studies. While further analyses indicated several
potentially important preconditions for choice overload, no sufficient conditions
could be identified."_

From the body:

- The forest plot's summary diamond is **D = 0.02, N = 5,036**. [P]
- **Set sizes across the whole corpus:** _"Across all experiments, assortment sizes
  for the small choice conditions had an average size of seven (IQR five to six)
  versus 34 for the large assortments (IQR 24–30)."_ This is the single most
  load-bearing sentence in this document for the hero question. [P]
- Direct replications failed: _"Scheibehenne (2008) aimed to replicate the results of
  the Iyengar and Lepper (2000) jam study in an upscale supermarket in Germany but
  did not find any negative effects of choice overload. Likewise, Greifeneder (2008)
  found no difference between small and large assortment sizes for choices among
  exotic chocolates in the lab. A related attempt to replicate the earlier studies by
  using jelly beans instead of chocolates also failed (Scheibehenne 2008)."_ [P]
- **Preconditions**, stated as necessary but not sufficient: a lack of prior
  preferences or familiarity with the items, and — verbatim — _"choice overload can
  occur only if there is no obviously dominant option in the choice set and if the
  proportion of nondominated options is large, because otherwise the decision would
  be easy regardless of the number of options."_ [P]
- Publication bias: published articles reported more positive effects than
  unpublished manuscripts (β = .27, SE .10, z = 2.72, p = .007), and later studies
  reported smaller ones (β = −.05, p = .035). [P]
- _"Within the tested range, there is no linear relationship between the effect size
  and the number of options offered in the large choice set."_ [P]

---

## 4. Chernev, Böckenholt & Goodman 2015 — the rebuttal, and what it concedes

_Choice overload: A conceptual review and meta-analysis_, Journal of Consumer
Psychology 25(2), 2015, 333–358. PDF read directly. [P]

Abstract, verbatim: _"In a meta-analysis of 99 observations (N = 7202) reported by
prior research, we identify four key factors — choice set complexity, decision task
difficulty, preference uncertainty, and decision goal — that moderate the impact of
assortment size on choice overload. … Finally, we document that when moderating
variables are taken into account the overall effect of assortment size on choice
overload is significant — a finding counter to the data reported by prior
meta-analytic research."_

This is the strongest pro-choice-overload paper there is, and it concedes the main
effect. p. 346, verbatim: _"The data show that in the absence of the conceptual
moderators, the mean effect of assortment size on choice overload is nonsignificant
(t(20) = −.10; p = .48) — a finding consistent with the findings reported by prior
research (Scheibehenne et al., 2010)."_ Their claim is conditional: overload appears
when the task is hard, the set is complex, the chooser has no settled preference,
and the chooser's goal is to minimise effort rather than to buy. [P]

Their set sizes, p. 346: _"the mean assortment sizes in the option-choice task were
4 and 12, significantly smaller than the corresponding assortment sizes of 8 and 34
in the other decision tasks."_ **Four is the smallest arm anywhere in either
meta-analysis.** A three-button row is below the floor of the entire
literature. [P]

**How to state this honestly:** choice overload is real under named conditions and
absent as a general law. Neither reading licenses a rule about two versus three
labelled buttons, because no study in either corpus manipulated anything that
small.

---

## 5. Hick's law at the source, and the one paper that checked whether it applies

**Hick, W. E. (1952).** _On the rate of gain of information._ Quarterly Journal of
Experimental Psychology, 4, 11–26. Method as described by Liu et al. (below, [P]):
ten lamps in an irregular circle, one Morse key per finger, a lamp lit every 5
seconds, number of stimuli varied from 2 to 10. **Hick was the only participant in
the first experiment and trained himself over 8,000 trials before it.** The
companion study is **Hyman, R. (1953)**, _Stimulus information as a determinant of
reaction time_, Journal of Experimental Psychology 45, 188–196 — cited as [S]: the
citation is taken from Liu et al.'s reference list, the paper itself was not read
in this session.

**Liu, W., Gori, J., Rioul, O., Beaudouin-Lafon, M. & Guiard, Y. (2020).** _How
Relevant is Hick's Law for HCI?_ CHI '20, Paper 749, Honolulu. PDF read
directly. [P] This is the credible critique the brief asked for, and it is stronger
than expected.

Abstract, verbatim: _"We review the choice-reaction time literature and argue that:
(1) Hick's law speaks against, not for, the popular principle that 'less is better';
(2) logarithmic growth of observed temporal data is not necessarily interpretable in
terms of Hick's law; (3) the stimulus-response paradigm is rarely relevant to HCI
tasks, where choice-reaction time can often be assumed to be constant; and (4) for
user interface design, a detailed examination of the effects on choice-reaction time
of psychological processes such as visual search and decision making is more fruitful
than a mere reference to Hick's law."_

The argument behind (1), worked through on pp. 7–8 with a 32-item car site: because
`RT = a + b·log₂(n)` is concave, showing all N at once costs less total time than
splitting them into subgroups, since each extra level re-pays the constant `a`.
Verbatim: _"the optimal strategy according to Hick's law consists of displaying all
the items at once on the same page, contrary to the design principle that choices
should be categorized"_ and _"It is never advantageous to split elements into
uncategorized subgroups of equal sizes."_ Their conclusion: _"Using a simple car
scenario, we also demonstrate that Hick's law, or rather a logarithmic function,
cannot justify the 'Hick-based' design principle for organizing a set of
choices."_ [P]

And on whether the paradigm transfers at all: _"Hick's law in HCI and the psychology
of choice-reaction time is of little relevance to most HCI applications because high
S-R compatibility and over-learned tasks result in very short and almost constant
reaction times."_ A labelled button a visitor reads is not a lamp a trained subject
reacts to. [P]

**Conclusion for this hero:** citing Hick's law to cut a button is a
misapplication, and the only peer-reviewed examination of the practice says the
law, taken seriously, points the other way.

---

## 6. What the practitioner sources actually say

### Nielsen Norman Group

Report what they say, including where it does not match the academic record.

- _Choice Overload Impedes User Decision-Making_ (Alita Kendrick, 2020-02-07):
  _"Too many offerings (e.g., products or services) on a website make it harder for
  users to make a decision due to analysis paralysis. Alternatively, too many options
  can also cause users to hastily make a decision and later regret their choice due
  to buyer's remorse."_ [P]
- _Simplicity Wins over Abundance of Choice_ (Hoa Loranger, 2015-11-22): _"An excess
  of choices can lead to fatigue and can make people feel dissatisfied with the
  experience, or even worse, abandon the process altogether"_, and _"The correct
  level of choices or features relies on many of factors, including context, the
  user's level of commitment and expertise."_ No numeric recommendation is
  given. [P]
- _Hick's Law: Designing Long Menu Lists_ (Katie Sherwin, 2018-07-06): _"Hick's Law
  (or the Hick–Hyman law) says that the more choices you present to your users, the
  longer it takes them to reach a decision"_, with the qualifier that _"combining
  Hick's Law with other design techniques can make long menus easy to use."_ [P]

**Honest finding, contrary to the brief's expectation:** NN/g does **not** qualify
or push back on choice overload. Searching nngroup.com for the replication
literature returned nothing; the pages above present the effect as settled, do not
cite Iyengar & Lepper, and do not mention Scheibehenne or Chernev. Their advice is
prescriptive design guidance, not a reading of the evidence, and it should not be
cited as independent confirmation that three CTAs are too many. All three NN/g
pages are about **menus and product assortments** — ten to twelve items and up — not
about two versus three buttons. [P]

Where NN/g is directly useful is hierarchy, not count. From their button guidance:
primary buttons _"have the most visual emphasis to grab user attention and direct
them to an important or common action"_ and are _"typically solid, filled buttons"_;
secondary buttons _"have a medium visual emphasis and are meant for actions that are
less important or commonly used"_ and are _"typically outline buttons"_; tertiary
buttons _"have the least amount of visual emphasis."_ [P] That is an exact
description of the shape this hero should have — and, at `HEAD`, of a hero that
assigns the filled style to the channel the business values least.

### Baymard Institute

Baymard's published material supports the hierarchy reading and not a count rule.
On guest checkout they document that _"participants were much more likely to
overlook the option for 'Guest Checkout' when it was implemented as a simple text
link"_, and conclude _"'Guest Checkout' should always be presented as a button
rather than a text link"_ and should be _"the most prominent option."_ [P] The
failure mode there is two paths to the same end where one is visually
under-weighted — the visitor takes the heavier one, not the better one.

Their general e-commerce guidance says competing buttons around the primary CTA
dilute it and that on mobile, where there is less page context on screen at once,
core actions need to be obvious without hunting. [S] — this came back through search
summaries of `baymard.com/blog/ecommerce-ux-audit` and
`baymard.com/blog/ecommerce-ux-best-practices` rather than from reading the full
pages, and Baymard's own test-subject counts for those specific claims were not
retrieved. A Baymard finding stating a tested number of CTAs in a hero:
**[NOT ESTABLISHED]**.

### Published A/B evidence with a stated method

**[NOT ESTABLISHED].** No public experiment manipulating the _number_ of CTAs in a
hero, with sample size, duration and statistical treatment stated, was found.
GoodUI's corpus is the closest thing (644 tests, 141 patterns, 149,189,834
visitors, per their own public counter [S]), but per-test effect sizes sit behind
membership and no pattern in the public index is "number of CTAs". CXL publishes CTA
advice without a traceable experiment behind the count question. Everything else
returned by search was a listicle recycling the jam study.

What would answer it: a GoodUI membership pull for any pattern that varies CTA
count, or a published test with a stated method. Until then, treat every "one CTA
converts 371% better" claim as unsourced.

---

## 7. Competing offers vs. one offer through several channels

This is the crux the owner identified, and the honest answer is that **no source
found in this session tests it directly**. The choice-overload corpus is entirely
assortments of _substitutable goods_ — jams, chocolates, jelly beans, pens, coffee,
wallpapers, 401(k) plans, dating partners, music CDs (Scheibehenne et al. 2010,
p. 412 [P]). Nothing in either meta-analysis manipulates _routes to one outcome_.
Searching for research on channel choice in a contact block returned nothing
usable. **[NOT ESTABLISHED]** — do not claim a study says channels are exempt.

What can be said with a source is weaker, and it is an argument from the
preconditions the overload researchers themselves name:

- Scheibehenne et al., p. 410–411: overload requires _"no obviously dominant option
  in the choice set"_ and a lack of _"prior preferences"_; they call these _"necessary
  but not sufficient preconditions."_ [P] A visitor who already uses Telegram daily
  and never answers unknown numbers has a dominant option before the page loads.
- Chernev et al.: the four moderators are choice-set complexity, decision-task
  difficulty, preference uncertainty, and an effort-minimising decision goal. [P]
  Three one-word channels differing on a dimension the visitor has a settled habit
  about scores low on complexity and low on preference uncertainty.

So the reasoning is: _if_ the mechanism is what these papers say it is, a channel
row should not trigger it. That is a mechanism argument, not evidence, and it should
be labelled as such whenever it is repeated. The counter-consideration is real too:
Liu et al. note that when a person _compares_ items pairwise rather than reacting to
one, response latency grows with N(N−1)/2 rather than log N [P] — a hero row is
plausibly a scan, not a comparison, but nothing here establishes which.

---

## 8. The channels are not equally valuable to this business

This part needs no outside literature; the repo measured it.

Commit **`d9716d5`** (2026-09-24), from the lead store: _"Of 24 such leads, 12 were
never touched and none became a deal; of 10 form leads, 6 progressed and one
closed."_ [P] A `contact_click` lead reaches the operator with the contact field set
to `—` and a boilerplate comment — no name, no car, no budget, no way to reach
anyone. A form lead carries a contact by construction (`@podbor/lead-crm`'s schema
requires it; only `name` is optional, per ADR 0015). [P]

`white-vs-dark-theme-lead-drop.md` adds the volume picture: in the 36-lead
production blob split at the repaint, contact clicks ran 0.96/d then 0.59/d against
form submissions at 0.61/d then 0.47/d — so **roughly half of all leads arrive by
the route that has never produced a deal.** [P]

That is what decides the ranking. The three controls are not equally valuable, so
they must not be equally prominent, and the one with the most visual weight should
be the one that produces an answerable lead.

**The constraint from ADR 0015.** `docs/adr/0015-lead-form-asks-only-for-a-contact.md`,
amended 2026-10-02: a messenger tile must open the messenger. The CRO audit (issue
#56) priced the alternative — _"in 6 of 18 visits in the window the visitor went
hunting for a direct messenger link after a tile labelled «Написать в Telegram»
produced a form. The label promised one thing and did another."_ [P]

The recommendation below lives with that ADR rather than arguing against it, and
nothing here is a reason to revisit it. Demoting Telegram _visually_ is not the same
move as making it open a form: the label still promises a messenger and still
delivers one, with the locale-specific prefill the ADR describes. The detour the
audit priced does not come back.

### Recommendation for this hero

**Keep three on a phone. Change which one is filled.**

1. **Primary, filled, full width: the lead form** — the modal trigger on the
   homepage («Оставить заявку»), the page's own `ctaLabel` on a service page
   («Подобрать авто», «Получить оценку»). Rationale: NN/g's own definition of a
   primary button is the one you want pressed [P]; this repo's lead data says that
   is the form [P].
2. **Secondary, outlined: «Написать в Telegram»**, still a direct link to the
   messenger, still prefilled, still `target="_blank"`. ADR 0015 is satisfied. A
   visitor whose dominant preference is Telegram will take an outlined button
   without hesitating — Baymard's guest-checkout finding is about an option demoted
   to a _text link_, not about an outlined button. [P]
3. **Secondary, outlined: «Позвонить»**, unchanged — already `pointer-fine:hidden!`,
   already correct per `AGENTS.md`'s pointer rule.
4. **Do not add a fourth** and do not re-add the service picker; and remember the
   header CTA and the floating widget are already on the same screen.

This is exactly what the uncommitted working tree now does (§1), so the
recommendation is "ship that", not "build something new" — with the two defects in
§1 fixed first: the deleted fine-pointer callback branch, which `AGENTS.md`
explicitly requires, and the `lg+` hero left with no filled control.

**What this does not claim.** It does not claim the change will raise total leads.
The plausible first-order effect is a shift in the _mix_ — more form leads, fewer
contact clicks, total roughly flat — and since a form lead is the only kind that has
ever progressed, a flat total with a better mix is the win. §10 says how to watch
for that and how long it takes.

---

## 9. Tap targets and spacing at 390 px

Geometry computed from the classes in `ContactCTA.astro` and `Button.astro` plus
`src/styles/global.css` (`.btn` sets only `position: relative`; no `min-height`
override exists). Tailwind defaults: `text-sm` = 14px/20px line box, `py-3` = 0.75rem
= 12px each side, `gap-3` = 12px, `px-6` = 24px. [P]

At a 390 px viewport, container `max-w-6xl mx-auto px-6` → content width **342 px**.

| control                                    | width   | height                                   | basis             |
| ------------------------------------------ | ------- | ---------------------------------------- | ----------------- |
| primary, `w-full`                          | 342 px  | **44 px** (12 + 20 + 12, no border)      | filled `Button`   |
| each secondary, `flex-auto` sharing a row  | ~165 px | **46 px** (12 + 20 + 12 + 2×1 px border) | outlined `Button` |
| vertical gap between rows                  | —       | 12 px                                    | `gap-3`           |
| horizontal gap between the two secondaries | 12 px   | —                                        | `gap-3`           |

Against the standards:

- **WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA** — _"The size of the target
  for pointer inputs is at least 24 by 24 CSS pixels"_, with exceptions for spacing,
  equivalent control, inline, user-agent control and essential. [P] **Passes by
  roughly 2×.** The spacing exception (the 24 px-diameter circle test) applies only
  to _undersized_ targets, so it is not engaged here.
- **WCAG 2.2 SC 2.5.5 Target Size (Enhanced), Level AAA** — _"The size of the target
  for pointer inputs is at least 44 by 44 CSS pixels"_. [P] **Passes**, 44 px and
  46 px. Worth knowing: at `HEAD` the `flex-col` stack passed too; the working
  tree's `flex-wrap` row does not change the heights.
- **Apple HIG** — _"Create controls that measure at least 44 points x 44 points so
  they can be accurately tapped with a finger"_, stated as _"44pt x 44pt minimum"_.
  [P] **Meets it exactly**, with no headroom on the 44 px primary.
- **Android / Material** — _"For touch interfaces, we recommend that each
  interactive UI element have a focusable area, or touch target size, of at least
  48dp×48dp. Larger is even better."_ [P] **2–4 px short.** A Material-strict review
  would ask for `py-3.5` (14px) on the primary. This is a recommendation, not a
  conformance failure, and it is the only standard any of these buttons misses.
- **A minimum spacing requirement between already-conformant targets** in Material
  or Apple HIG: **[NOT ESTABLISHED]** — the Material/Android page read in this
  session states the 48 dp size and says nothing about inter-target spacing, and
  Apple's tips page gives no figure. A specific "8 dp between targets" number was
  not verified from a primary page and is therefore not asserted here.

**Verdict on the mis-tap question:** three stacked full-width buttons at 390 px are
not a mis-tap hazard. Every target exceeds both WCAG thresholds, and an adjacent-
target error requires a 12 px vertical slip onto a 44 px target. The accessibility
argument for cutting a button does not exist. One real finding in the neighbourhood:
the header's always-visible CTA is `h-9` = **36 px**, which clears SC 2.5.8 (AA) but
fails SC 2.5.5 (AAA) and both platform minimums. [P] That is the smallest contact
control on the page, and it is not in the hero row.

---

## 10. What would actually settle it for this site

### The experiment, if traffic allowed

- **Unit:** session. **Arms:** A = hero with Telegram filled (the `HEAD` shape),
  B = hero with the form filled (the working-tree shape). Everything else identical.
- **Primary metric:** `form_submit` per session — the goal already fires on server
  acceptance, not on button press, so a refused submission counts as `form_error`
  with `field: server`. [P]
- **Secondary metrics, all already instrumented in `packages/site-kit/src/goals.ts`
  and documented in `docs/guides/analytics.md`:** `lead_modal_open` (params `tab`,
  `service`), `contact_click` (params `channel`, `placement` — and `placement`
  already distinguishes `hero` from `bar`, `floating`, `footer`, `header`, `thanks`
  via `CONTACT_PLACEMENTS`), `form_view`, `form_start`, `form_error`, plus the
  `/thanks/` URL goal and the composite "ENQUIRY FUNNEL: saw → started →
  submitted". **Nothing new needs registering in the three Metrika counters.** [P]
- **Guard metric:** total leads per day from the blob, so a mix shift that costs
  volume is visible.

### Why it is not viable

Two-proportion sample size, 80% power, α = .05 two-sided:

```
n per arm = (1.96 + 0.84)² × [p₁(1−p₁) + p₂(1−p₂)] / (p₁ − p₂)²
```

Baseline: the measured post-period `form_submit` CR is **1.84%** (3 of 163 sessions)
and the `/thanks/` URL goal 3.07%. [P] Take p₁ = 2%.

| relative lift | p₂   | sessions per arm | sessions total |
| ------------- | ---- | ---------------- | -------------- |
| +20%          | 2.4% | 21,106           | **42,212**     |
| +50%          | 3.0% | 3,823            | **7,646**      |
| +100%         | 4.0% | 1,138            | **2,276**      |

Measured traffic: **116 sessions in 31 days** (pre-period) and **163 in 17 days**
(post), exclusions applied. [P] Call it 116–290 sessions a month.

- +20%: **12 to 30 years.**
- +50%: **2 to 5 years.**
- +100% — a doubling, which no CTA restyle has ever produced: **8 to 20 months.**

**An A/B test on this hero is not viable and will not become viable at this traffic
level.** Anyone proposing one should be shown this table. The same arithmetic kills
A/B testing of any session-level conversion change on this site.

### What to do instead

1. **Decide from mechanism, ship it, and record the date.** The decision rests on
   §8's lead-quality data, which is already measured, plus a hierarchy principle
   neither NN/g nor Baymard disputes. Write the deploy timestamp into the ADR or the
   commit the way `white-vs-dark-theme-lead-drop.md` had to reconstruct it from
   GitHub Actions run `34873281542` — recovering a deploy time after the fact is
   avoidable work.
2. **Watch the lead _mix_, not the session CR.** The mix is a proportion of leads,
   not of sessions, so it needs far fewer observations. At ~1 lead/day ≈ 30/month,
   detecting a shift from 55/45 form/click to 25/75 needs about **38 leads per
   period** (same formula, p₁ = .55, p₂ = .25 → 7.849 × (.2475 + .1875) / .09 = 37.9),
   i.e. roughly **2.5 months of before-and-after**. That is reachable. It is still
   a before/after comparison, not a randomised one, which is exactly the confound
   `white-vs-dark-theme-lead-drop.md` spent 600 lines on — so state the confounds
   (traffic mix, season, any other change shipped in the window) up front and do not
   convert the result into a causal claim.
3. **Mind the two instrument breaks before reading any history.** `form_submit`
   changed meaning on 2026-09-24 (`d9716d5`) and `contact_click` again on 2026-10-02
   (issue #92, modal opens no longer counted as clicks). Any comparison spanning
   those dates is comparing two different definitions. [P]
4. **Five moderated sessions beat the A/B test here.** With 160–290 sessions a
   month, watching five people in the target locale try to contact the business on a
   phone will surface "I didn't know which one to press" far faster than any
   counter will. No source is cited for the number five, and none is needed: the
   alternative is a 12-year experiment.
5. **If the mix does not move**, the hierarchy was not the binding constraint and
   the next candidates are the ones `white-vs-dark-theme-lead-drop.md` already
   ranked — form position on mobile, and the share of sessions that ever see a form
   at all (`form_view` reaches 29.45% of sessions). [P]

---

## 11. What could not be established

- **Any experiment manipulating the number of CTAs** (two vs three vs four) in a
  hero or anywhere else, with a stated method. **Unknown.** Answered by: a GoodUI
  membership pull for any CTA-count pattern, or a published test with sample size,
  duration and statistical treatment.
- **Whether choice overload applies to channels rather than to substitutable
  goods.** **Unknown**, and no study in either meta-analysis is close. Answered by:
  an experiment varying the number of contact channels with the offer held constant.
  §7's argument from the stated preconditions is reasoning, not a finding.
- **Baymard's own test-subject counts** behind the "competing CTAs" guidance. The
  guest-checkout page cites _"large-scale testing"_ and _"multiple rounds of
  testing"_ without numbers for that specific comparison. **Unknown.** Answered by:
  a Baymard subscription and the underlying study pages.
- **A primary-source minimum spacing figure** between already-conformant touch
  targets in Apple HIG or Material. **Unknown.** Answered by: reading the current
  HIG "Layout" and Material "Accessibility" pages in a browser — both are
  JavaScript-rendered and returned no body text to a fetch in this session.
- **Hyman (1953)** was cited from Liu et al.'s reference list, not read. [S]
- **The owner's "92% of traffic is mobile"** is right for the pre-repaint window
  (92.2% measured [P]) but **stale**: the latest measured window is **77.9% mobile,
  20.9% desktop**, on 163 sessions. [P] The hero decision should assume roughly a
  fifth of visitors are on a fine pointer — where, in the uncommitted working tree,
  the hero currently has no filled CTA at all and no phone control.
- **Whether three controls actually confuse this site's visitors.** No session
  recording, heatmap or usability session was available in this research.
  **Unknown.** Answered by item 4 in §10.

---

## Sources

Primary, read directly in this session:

- Iyengar, S. S. & Lepper, M. R. (2000). _When Choice Is Demotivating: Can One
  Desire Too Much of a Good Thing?_ Journal of Personality and Social Psychology,
  79(6), 995–1006. DOI 10.1037/0022-3514.79.6.995.
  <https://faculty.washington.edu/jdb/345/345%20Articles/Iyengar%20&%20Lepper%20(2000).pdf>
- Scheibehenne, B., Greifeneder, R. & Todd, P. M. (2010). _Can There Ever Be Too
  Many Options? A Meta-Analytic Review of Choice Overload._ Journal of Consumer
  Research, 37(3), 409–425. DOI 10.1086/651235.
  <https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf>
- Chernev, A., Böckenholt, U. & Goodman, J. (2015). _Choice overload: A conceptual
  review and meta-analysis._ Journal of Consumer Psychology, 25(2), 333–358.
  DOI 10.1016/j.jcps.2014.08.002.
  <https://chernev.com/wp-content/uploads/2017/02/ChoiceOverload_JCP_2015.pdf>
- Liu, W., Gori, J., Rioul, O., Beaudouin-Lafon, M. & Guiard, Y. (2020). _How
  Relevant is Hick's Law for HCI?_ CHI '20, Paper 749. DOI 10.1145/3313831.3376878.
  <https://perso.telecom-paristech.fr/rioul/publis/202001liugoririoulbeaudouinlafonguiard.pdf>
- W3C, _Understanding SC 2.5.8: Target Size (Minimum)_ (WCAG 2.2, Level AA).
  <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- W3C, _Understanding SC 2.5.5: Target Size (Enhanced)_ (WCAG 2.2, Level AAA).
  <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html>
- Apple, _UI Design Dos and Don'ts_. <https://developer.apple.com/design/tips/>
- Android Developers, _Make apps more accessible_ (touch target size).
  <https://developer.android.com/guide/topics/ui/accessibility/apps>
- Nielsen Norman Group: _Choice Overload Impedes User Decision-Making_ (Kendrick, 2020) <https://www.nngroup.com/videos/choice-overload/>; _Simplicity Wins over
  Abundance of Choice_ (Loranger, 2015)
  <https://www.nngroup.com/articles/simplicity-vs-choice/>; _Hick's Law: Designing
  Long Menu Lists_ (Sherwin, 2018)
  <https://www.nngroup.com/videos/hicks-law-long-menus/>; _Button States: Communicate
  Interaction_ <https://www.nngroup.com/articles/button-states-communicate-interaction/>
- Baymard Institute, _Make "Guest Checkout" Prominent_.
  <https://baymard.com/blog/make-guest-checkout-prominent>
- Hick, W. E. (1952). _On the rate of gain of information._ Quarterly Journal of
  Experimental Psychology, 4, 11–26 — method and citation taken from Liu et al.
  (2020); the 1952 paper itself was not read. [S]
- Hyman, R. (1953). _Stimulus information as a determinant of reaction time._
  Journal of Experimental Psychology, 45, 188–196 — citation from Liu et al. (2020);
  not read. [S]

In this repository:

- `apps/approved-rs/src/components/ContactCTA.astro`,
  `apps/approved-rs/src/components/Button.astro`,
  `apps/approved-rs/src/components/RegionalContactButton.astro`,
  `apps/approved-rs/src/layouts/ServicePageLayout.astro`,
  `apps/approved-rs/src/pages/[locale]/index.astro`,
  `apps/approved-rs/src/components/Header.astro`,
  `apps/approved-rs/src/styles/global.css`,
  `apps/approved-rs/src/content/i18n/services.yaml`,
  `apps/approved-rs/src/content/i18n/dictionary.yaml`
- `packages/site-kit/src/goals.ts`, `docs/guides/analytics.md`
- `docs/adr/0015-lead-form-asks-only-for-a-contact.md`
- `docs/research/white-vs-dark-theme-lead-drop.md`
- commit `d9716d5` (2026-09-24)
