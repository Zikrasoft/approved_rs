---
name: case-content-style
description: Use when writing or reviewing a case-study markdown file in src/content/cases, src/content/autoservice-cases, or src/content/detailing-cases — new case from the client, imported/bot-generated content, or a request to clean up, review, or format case copy.
---

# Case Content Style

## Overview

Case files (client work write-ups) on approved.rs get bot-imported or
hand-written and drift from house style: decorative emoji instead of real
lists, `— item\` fake bullets that render as plain lines, no bold emphasis,
SEO keyword-dump tails, wrong register words, bad `year`/`date` values.
This skill is the checklist to bring one back in line.

**Reference example:** `src/content/cases/bmw-x3-1/index.md` — real
`<ul class="icon-check">` list, natural bold emphasis, no emoji, no keyword
tail, all 3 locales complete. Read it once to see the target shape. Note its
bold density is on the light side (car spec + city name, not every
paragraph) — for item 4 below, judge density against the other files in the
_same_ collection (cases / autoservice-cases / detailing-cases), not against
this one file alone. A file with zero bold anywhere is the one case that's
always wrong regardless of sibling density — add some.

## Checklist

Work through every locale present in the file: the RU body below the second
`---`, plus `translations.en.body` and `translations.sr.body` in the
frontmatter. Fix all three in lockstep — never leave one formatted and the
others untouched.

1. **No emoji.** Delete decorative emoji (🔍📍🔧⚙️📊🕹🚗🔎 etc.). Section
   flags/checkmarks belong to the list-icon system below, not inline text.
2. **Real lists, not fake ones.** `— item\` / `• item` / bare lines are not
   markdown lists — they render as plain paragraphs with no marker at all.
   Convert to an actual list.
3. **Pick the list-icon by what it enumerates**, don't default to plain
   `- item` (wrench) for everything — vary icons across a page so two lists
   back-to-back don't show the same glyph. Classes live in
   `src/styles/global.css` around `.prose-custom ul`:

   | Icon                | Class                      | Use for                                                      |
   | ------------------- | -------------------------- | ------------------------------------------------------------ |
   | 🔧 wrench (default) | `- item` (no class needed) | generic work steps, technical checks                         |
   | ✓ check             | `<ul class="icon-check">`  | client requirements, package contents, "what's included"     |
   | 🛡 shield            | `<ul class="icon-shield">` | protection/safety benefits (PPF, detailing)                  |
   | 📍 pin              | `<ul class="icon-pin">`    | city/coverage lists ("Belgrade, Novi Sad, and other cities") |

   For the wrench, plain markdown `- item` works. For the other three you
   need real HTML embedded in the markdown, since marked/remark pass raw
   HTML through untouched: `<ul class="icon-check">\n<li>text</li>\n</ul>`
   (one `<li>` per line, no markdown `-`).

4. **Bold the key facts**, not everything. 1–3 `**bold**` spans per
   paragraph on the concrete, scannable bits: car spec, price/mileage
   numbers, city names, service names. Judge density by comparing against
   sibling files in the same collection (see the reference-example note
   above) — but a file with literally zero bold anywhere is wrong on any
   comparison, always fix that one.
5. **Cut SEO tails — judge by genericness, not punctuation.** These show up
   two ways: (a) a bare comma/pipe/bullet-separated keyword list, sometimes
   literally labeled `Keywords:`/`Ključne reči:`/`Ключевые слова:`
   (`PPF Belgrade, paint protection film Belgrade, 190 micron PPF, ...`);
   (b) a full sentence that _reads_ like real copy but is generic
   service-plus-city boilerplate ("**Car sourcing in Belgrade and Serbia**
   — inspection, diagnostics... We work across Serbia: Belgrade, Novi Sad,
   Čačak..."). The test for (b) isn't grammar, it's whether the sentence
   references anything specific to _this_ case (the actual car, client,
   request) — if you could paste it unchanged onto a different case in the
   same service category and nothing would read wrong, it's the same
   keyword-dump disease wearing a verb. Delete both kinds entirely, all
   three locales. Keep genuine narrative mentions of a city/service woven
   into a sentence that's actually about this case's story — those aren't
   tails, don't touch them (and per item 4, they're often worth bolding).
6. **Fix wrong-register machine-translation artifacts** — e.g. a `большой
сервис` mistranslated as `великий сервис` (that word means "great" as in
   "Peter the Great", not "big"). Read the RU body like a native speaker
   would, not just for typos.
7. **Sanity-check `year:`.** It must roughly match `date:` and be a real
   model year (not e.g. `2029` on a current-day case). If it looks wrong,
   flag it to the user rather than silently guessing — you can't see the
   photos well enough to know the actual model year for certain older/newer
   trims.
8. **Don't touch what isn't broken.** `car`, `price`, `service`,
   `servicesApplied`, `country`, `gallery`, `image` are structured data —
   leave them alone unless factually wrong and confirmed.

## Verify

After editing, run `npx astro check` (must stay 0 errors — a stray `<ul>`
without a closing `</li>` or a broken YAML block scalar will show up here).
If you touched list-icon classes, spot-check one page in a browser: the
markdown files alone don't tell you whether a filled/outline glyph reads
legibly at the live render size, only rendering does.
