# Open questions

What is waiting on a decision or on data from the owner, plus technical debt with
no owner. Decisions that have been made live in [`docs/adr/`](../adr/); don't
duplicate them here, and delete a question once it is closed.

State as of 2026-09-29: all three sites are in production, and the `deployed/*`
tags sit on `8b46200`.

## From the owner: data and copy

### Details' contacts

`PUBLIC_TG_MANAGER` and `PUBLIC_INSTAGRAM` for Details are placeholders under a
`TODO:` in `apps/detailing/src/utils/constants.ts`. They end up in the `sameAs`
markup and in the Telegram button, and `PUBLIC_INSTAGRAM` defaults to
`details.studio` — so the site quietly shows somebody else's account. CarLab
already has a channel: `t.me/carlabrs`.

### Postcode

The address is `Jovana Ćirilova 23a`, Zvezdara, Belgrade (`WORKSHOP_ADDRESS` in
`packages/brands`). Zvezdara has several postcodes and guessing is not an option,
so `postalCode` was removed from the markup (it is optional in `PostalAddress`).
Send it and it goes back; it is collected together with the registration details on
[#79](https://github.com/Zikrasoft/approved_rs/issues/79).

Both brands sit in one building and on one phone number — the owner knows and
accepts that. The plan is three different addresses for three businesses; that is
an organisational decision, not a technical one.

### Photographs and evidence for Details

- **"Before" shots.** The `beforeImage` field exists but is filled in for not one
  piece of work. Fill it and the comparison slider turns on, on the work's page
  and on the homepage.
- **A shot of ruined material** — yellowed or peeling film on somebody else's car
  at intake. The materials section claims cheap film yellows within a season and
  comes off along with the lacquer, and there is no evidence of that on the page.
  Such a thing cannot be drawn — that would be fabricating evidence on a site that
  sells trust.
- **The material brand on work cards.** Works are currently tagged by service, not
  by material brand. Tag them and the material filters can show real examples
  instead of illustrations.
- **The GLS case** is published with the text "we'll show the result when we're
  done" and an empty gallery.

### Case studies for service pages that have no evidence

For Details: polishing/ceramics and steering-wheel restoration. For CarLab: body
repair and pre-purchase inspection. The highest-margin pages, with nothing to show
on them.

### Unverified claims on the sites

The 12-month warranty (on labour, or on parts too?) — the owner ruled on
[#68](https://github.com/Zikrasoft/approved_rs/issues/68) that shop parts carry
the manufacturer's warranty only, which says nothing about this claim on the
service pages. Also "a reply within 2 hours",
"around the clock, seven days a week", the share of recovered cars per country.

### CarLab prices in dinars

Deferred until 2026-12-01. The owner decided (2026-09-13) not to show prices on
detailing at all and to remove them from the auto-service pages. Only the rendering
was removed: the `priceFrom` fields stay in the YAML and the zod schemas, because
the schemas are `.strict()` with required fields, and dropping the keys would drag
in `registry.test.ts` and the translation script. To bring them back: the rendering
in two components.

## From the owner: decisions

### Where the bot's infrastructure lives

The webhook and the reminder cron for all three brands live in the approved.rs
project. Raised by the owner on 2026-09-14, no decision yet. The options and a
recommendation are in
[ADR-0014](../adr/0014-bot-webhook-and-cron-hosted-by-approved-rs.md).

### Launching the CarLab shop

The shop is in `main`, switched off: `SHOP_STATUS` defaults to `off`, so no shop
page is built and Medusa is never called. See
[ADR-0016](../adr/0016-carlab-shop-on-self-hosted-medusa.md) and the ten after
it, all accepted. Getting it to production is mapped on
[issue #61](https://github.com/Zikrasoft/approved_rs/issues/61), and what was
deferred rather than fixed before the merge is the two-tier checklist there.

Before the flag moves: a VPS ordered (check CX23 availability in the Hetzner
Console, [#69](https://github.com/Zikrasoft/approved_rs/issues/69)), a Brevo
account with DKIM ([#70](https://github.com/Zikrasoft/approved_rs/issues/70)),
secrets and the first deploy
([#71](https://github.com/Zikrasoft/approved_rs/issues/71)), the shop funnel
goals in the carlab.rs counter
([#72](https://github.com/Zikrasoft/approved_rs/issues/72)), real prices and
stock, the shop's legal pages
([#76](https://github.com/Zikrasoft/approved_rs/issues/76)), and — for online
payment later — an answer from the accountant about e-fiskalizacija.

The consumer protection act moved underneath all of that. Zakon o zaštiti
potrošača is now «Sl. glasnik RS» br. 35/2026, in force since 02.08.2026, and
88/2021 is repealed — any downloaded template, and any article older than August
2026, has the wrong numbers. Whether the 14-day right of withdrawal applies to
pickup at all is **not established**
([#74](https://github.com/Zikrasoft/approved_rs/issues/74)). What is established
is in `docs/research/serbia-online-shop-legal.md`.

The owner answered on
[#68](https://github.com/Zikrasoft/approved_rs/issues/68) (2026-09-30): batteries
only at launch, under 10 SKUs typed into the Medusa admin by hand, card fields as
already coded, installation priced «od X RSD», a 3-day reserve window, the
manufacturer's warranty only, returns at the counter, `info@carlab.rs` as the
sender, registrar access in the owner's hands, two admin accounts. One question
did not close and moved to
[#79](https://github.com/Zikrasoft/approved_rs/issues/79): the seller's poslovno
ime, PIB, matični broj and seat, which the legal pages cannot be written without.

The vehicle dictionary is gone until a product type requires fitment
([ADR-0028](../adr/0028-no-vehicle-dictionary-until-fitment-is-required.md)), so
its open naming questions (Doblo III/K9, Megane by sequence versus by code,
whether Aveo 310C and Lacetti are needed) are parked with the collected tree in
`docs/research/vehicles.json`. Whether to buy TecDoc access is still a separate
decision ([ADR-0024](../adr/0024-hand-collected-vehicle-dictionary.md)).

## Technical debt

- **`translate` couples the three brands.** It is one step across every app: an
  unfixable file on one site fails the job and nothing ships. It can be untangled
  with a matrix over `apps/*`, at the price of three parallel commits into one
  branch.
- **A `get`+`head` race in the Blob CAS**
  (`packages/lead-crm/src/storage/vercelBlob.ts`): a write between the two calls
  yields the etag of somebody else's version. Needs a check of etag behaviour in
  production.
- **The weight of the brands' contact pages.** 490 server-rendered `<option>`
  elements plus a second copy of the form inside a closed `<dialog>`: ~26 KB gzip
  where ~7 would do. `bindPhoneCountry`'s country list could come from a chunk that
  is already loaded dynamically.

## To check by hand in production

- The consent banner does not cover the floating contact button on mobile, on all
  three sites.
- The 301s for legacy slugs: `vercel.json` duplicates `middleware.ts` by hand, and
  they diverge silently
  ([ADR-0010](../adr/0010-locale-prefixed-urls-and-permanent-legacy-redirects.md)).
- Declining in the banner really does keep Metrika from starting on the next load.
- Meta descriptions in non-English locales: if the site name or the city is missing
  anywhere the Russian has `{siteName}` / `{location}`, the model dropped a token.
- `TELEGRAM_ADMIN_ID` is filled in on all three projects — otherwise the quarantine
  for unreadable enquiries works silently.

## Small things not to relitigate

The EU flag on the "From Europe" card stays, even though Switzerland is not in the
EU: the text was corrected to "European countries", and the icon asserts nothing.
