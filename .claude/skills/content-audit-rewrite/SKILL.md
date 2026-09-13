---
name: content-audit-rewrite
description: Use when writing, reviewing, cleaning up or rewriting any site copy in this repo — case and work markdown, page copy and meta strings in the i18n YAML. Covers house formatting (lists, emoji, bold, SEO tails), meta-string SEO limits, and humanizing AI-sounding prose. Applies to all three apps.
---

# Content Audit and Rewrite

## Overview

Two things go wrong with copy here. Case and work files get bot-imported or
hand-written and drift from house formatting — decorative emoji, fake bullets
that render as plain lines, keyword-dump tails. And almost every Russian string
was drafted by a model during the `feature/split` rebuild, so it reads like a
landing page rather than like a shop explaining its work.

This skill is one pass over one file covering both, plus the mechanical SEO
checks on meta strings.

## The rule that outranks everything else

**Edit the Russian source only. Never hand-edit anything under a `translations:`
key — not in YAML, not in case frontmatter.**

Both content systems hash the Russian source and store it as `translatedFrom`
(`packages/i18n/src/translate/sections.ts` for YAML, `translate/cases.ts` for
markdown). When that hash moves, every locale is regenerated from Russian. A
hand-polished Serbian string survives exactly until the next Russian edit, then
vanishes with no error anywhere.

This is why you fix formatting in Russian only and stop. Converting fake bullets
to a real list in the Russian body moves the hash, CI retranslates, and the
locales come back with the corrected structure. Editing four locales by hand is
wasted work that will be overwritten.

Order, not negotiable:

```
edit Russian → commit → push → CI translate job rewrites every locale
```

One exception: hand-written Serbian that is deliberately not machine translated.
After editing such a YAML by hand, run
`node --experimental-strip-types scripts/translate-i18n.ts --record-hashes` from
inside the app, or the next CI run hands your Serbian back to the model.

## Where the content is

| what                           | path                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| case bodies (approved.rs)      | `apps/approved-rs/src/content/cases/*/index.md`              |
| work bodies (Details, CarLab)  | `apps/{detailing,auto-service}/src/content/works/*/index.md` |
| product bodies (CarLab shop)   | `apps/auto-service/src/content/products/*/index.md`          |
| page and UI copy, meta strings | `apps/*/src/content/i18n/*.yaml`                             |

Product bodies are Russian-authored and auto-translated exactly like works, and
they render through `.prose-shop`, so the list icons apply there too. The shop
is currently behind `SHOP_ENABLED = false` in
`apps/auto-service/src/utils/constants.ts`, so those pages are not built — the
copy still counts as content and still rots.

Locale sets differ: approved-rs serves `ru en sr es de` and its cases carry four
translations; the brand sites serve `ru sr en` and their works carry two. Russian
is the authoring language everywhere (`SOURCE_LOCALE`). Which locale a site
_presents_ by default is `primaryLocale`, and that is `sr` on the brand sites —
do not confuse the two.

There is no blog or article collection in any app. "Write an article" currently
means a case/work body or page copy; a real article collection needs routes,
Keystatic config, sitemap and schema first, and that is a separate job.

**Reference example:** `apps/approved-rs/src/content/cases/bmw-x3-1/index.md` —
real list markup, natural bold emphasis, no emoji, no keyword tail. Read it once
to see the target shape. Its bold density is on the light side; judge density
against siblings in the _same_ collection, not against this one file.

## Project context to load before judging prose

Read the app's `src/i18n/translateConfig.ts` and use its `BUSINESS_DESCRIPTION`:

- **approved.rs** — car sourcing, import, buyback and inspection, Belgrade
- **Details** — premium detailing: PPF, colour-change wraps, machine polishing
  with ceramic, steering-wheel leather restoration
- **CarLab** — independent car service: diagnostics, servicing, brakes and
  suspension, engine and gearbox, accident repair and respraying, plus batteries

Copy must sound like that business talking to its own customer. A detailing
client looking for ceramic coating is not shopping for a car import. The three
brands are deliberately independent — never write cross-brand copy into a brand
site.

## Formatting checklist

1. **No emoji.** Delete decorative emoji (🔍📍🔧⚙️📊🕹🚗🔎). Section markers
   belong to the list system, not to inline text.
2. **Real lists, not fake ones.** `— item\` / `• item` / bare lines are not
   markdown lists — they render as plain paragraphs with no marker. Convert to an
   actual list.
3. **Pick the list icon by what the list enumerates.** All three apps carry the
   same three class names and the same glyph geometry, so markup moves between
   them unchanged. What differs per brand is the default glyph, the stroke
   weight and the accent colour:

   | app          | wrapper         | default glyph    | accent    | stroke |
   | ------------ | --------------- | ---------------- | --------- | ------ |
   | approved-rs  | `.prose-custom` | wrench           | accent    | 2      |
   | detailing    | `.prose-studio` | four-point shine | champagne | 1.5    |
   | auto-service | `.prose-shop`   | gauge            | signal    | 2.5    |

   On top of the default: `icon-check` for requirements, package contents and
   "what's included"; `icon-shield` for protection and warranty claims;
   `icon-pin` for city and coverage lists. Vary them so two lists back to back
   do not repeat the same glyph.

   Plain `- item` gets the default. The three named classes need real HTML
   (`<ul class="icon-check">`, one `<li>` per line, no markdown `-`). The HTML
   survives because bodies render through `marked` + `sanitize-html`, and
   `packages/site-kit/src/safeMarkdown.ts` allows `class` on every tag — without
   that line the sanitizer would strip `icon-*`.

   **Body markdown only.** A `<ul class="…">` written into an `i18n/*.yaml`
   string renders as visible literal text, not as a list.

   The classes only work **inside** a prose wrapper — the custom property and
   the `::before` rule both hang off `.prose-custom` / `.prose-studio` /
   `.prose-shop`. A bare `<ul class="icon-check">` elsewhere gets no marker at
   all, because Tailwind preflight has already removed the default one.

   Glyphs are CSS masks driven by a `--list-icon` custom property, so they
   inherit the brand accent and need no markup beyond the class. The mask is
   scoped to `ul li`, and each app restores `list-style: decimal` on `ol`, so
   ordered lists keep their numbers.

4. **Bold the key facts, not everything.** One to three `**bold**` spans per
   paragraph on the concrete, scannable bits: car spec, price and mileage
   numbers, city names, service names. A file with zero bold anywhere is always
   wrong; fix that one regardless of sibling density.
5. **Cut SEO tails — judge by genericness, not punctuation.** Two forms: a bare
   comma or pipe separated keyword list, sometimes labelled `Keywords:` /
   `Ključne reči:` / `Ключевые слова:`; or a full sentence that reads like real
   copy but is generic service-plus-city boilerplate. The test for the second is
   whether it references anything specific to _this_ case — the actual car,
   client or request. If you could paste it unchanged onto another case in the
   same category and nothing would read wrong, it is the same keyword dump
   wearing a verb. Delete both. Keep genuine narrative mentions of a city or
   service woven into a sentence that is actually about this case.
6. **Fix wrong-register translation artifacts** in the Russian. A big service
   rendered as `великий сервис` means "great" as in "Peter the Great", not
   "big". Read it like a native speaker, not just for typos.
7. **Sanity-check `year:`.** It must roughly match `date:` and be a real model
   year. If it looks wrong, raise it rather than guessing — you cannot tell the
   trim year from the photos.
8. **Leave structured data alone.** `car`, `price`, `service`,
   `servicesApplied`, `country`, `gallery`, `image` are data, not copy. Touch
   them only when factually wrong and confirmed.

## SEO checks on meta strings

Arithmetic first, judgement after.

1. **`metaTitle` at most 60 characters, `metaDescription` at most 160** — the
   SERP truncation points. Only those two keys have a length budget; a `title:`
   key elsewhere in the YAML is a section heading. Count the current backlog
   rather than trusting a number written here, which rots on the first fix:

   ```bash
   grep -rhoP '^\s*meta(Title|Description):\s*\K.*' apps/*/src/content/i18n/*.yaml \
     | sed "s/^['\"]//;s/['\"]$//" | awk '{ print length }' | sort -n | tail -20
   ```

2. **No duplicate meta strings within one app and one locale.** Two pages sharing
   a title compete with each other.
3. **Placeholders must survive.** Tokens look like `{location}`. Every token in
   the Russian source must appear in each translation and no new ones may appear;
   a dropped token renders a hole in the live page. **Nothing catches this
   automatically** — `assertSafeTranslation` checks only for missing strings,
   short arrays and introduced HTML tags, never tokens. Check by eye.
4. **Never let a model rewrite a meta string containing a placeholder.** The
   wording gain does not pay for losing the token. Edit those by hand.

## Humanize — mandatory, never skipped

**Every touched Russian body goes through the `humanizer` skill. There is no
"the text looks fine" exit.** Judging your own prose by reading it is exactly
what produced the current copy: the tells are invisible from the inside, which
is why the check has to be a separate pass rather than an opinion.

This applies to text you just wrote as much as to text you are cleaning up —
a body drafted in this same session is the most likely thing in the repo to
carry them.

Run the skill first, then check what it missed. The tells that actually appear
in this repo:

- staged openers that say nothing before the real sentence starts
- "не X, а Y" contrasts used for rhythm rather than meaning
- forced triads — three adjectives where one is true
- inflated claims a small Belgrade shop cannot support ("лучший",
  "премиальный" as filler rather than as a fact about the service tier)
- sales register instead of plain description
- one-line closers that restate the paragraph above

Keep every fact, number, price, car spec and proper noun exactly as written.
Humanizing changes wording, never facts. If a claim looks wrong, raise it instead
of quietly rewriting it.

Russian should read like a mechanic or a detailer explaining the work. Serbian
and English are derived from it, so fixing the Russian fixes all of them.

## Verify

- **Did the `humanizer` pass actually run on every Russian body you touched?**
  If the answer is "the text already read well", the pass did not run. Go back.
- `pnpm --filter @podbor/<app> typecheck` — a stray unclosed `<li>`, a broken
  YAML block scalar or a `.strict()` schema violation surfaces here
- `pnpm exec prettier --check apps/<app>/src/content` — the CI translate job
  commits YAML without running prettier, so drift there is normal and fixing it
  is in scope. Case markdown under `apps/approved-rs/src/content/cases` is in
  `.prettierignore` on purpose — do not reformat it
- If you touched list markup or anything with a placeholder, look at the rendered
  page; the markdown alone does not tell you whether a glyph reads legibly or
  whether a token resolved
