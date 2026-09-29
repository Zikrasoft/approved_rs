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
Send it and it goes back.

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

The 12-month warranty (on labour, or on parts too?), "a reply within 2 hours",
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

The shop is built on Medusa in branch `feat/carlab-shop` (unmerged): see
[ADR-0016](../adr/0016-carlab-shop-on-self-hosted-medusa.md) and the ones after
it. On `main` the old MVP is switched off with `SHOP_ENABLED = false`. Before
launch we need: a VPS ordered (check CX23 availability in the Hetzner Console), a
Brevo account with DKIM, real prices and stock, the legal texts (terms of sale,
14-day returns), and — for online payment later — an answer from the accountant
about e-fiskalizacija.

Also to ask the client:

- the card fields per product type (batteries, oils, filters, brakes): what to show
  on the card, what to filter by;
- installation prices (battery, pads/discs): fixed or "from";
- how many days we hold an unpaid pickup order;
- who works in the Medusa admin (names and emails for accounts);
- warranty, who accepts returns, the seller's registration details for the terms
  page;
- the sender address for email (e.g. `shop@carlab.rs`) and access to carlab.rs DNS.

Open on the vehicle dictionary's data: naming for Doblo III/K9, Megane by sequence
versus by code, whether Aveo 310C and Lacetti are needed. Whether to buy TecDoc
access is a separate decision
([ADR-0024](../adr/0024-hand-collected-vehicle-dictionary.md)).

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
