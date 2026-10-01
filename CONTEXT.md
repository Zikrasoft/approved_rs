# Context

Glossary for this repo. Terms only — no implementation detail, no decisions.
Decisions live in [`docs/adr/`](docs/adr/), conventions in
[`AGENTS.md`](AGENTS.md).

## Lead capture

**Lead** — one request from one visitor, stored once and owned by exactly one
brand. A form submission and a contact click both become Leads. A Lead's
`status` describes the **conversation** with that person, never the state of
anything they bought.

**Brand** — one of the three businesses (Approved, CarLab, Details). Stamped on
a Lead by the server; a visitor can never name one.

**Contact click** — a Lead created by tapping a messenger or phone tile rather
than by submitting a form. It carries a channel and no message.

## Shop

**Order** — a purchase in Medusa. Medusa is its only source of truth: its
status, its fulfillment and its inventory reservation all live there, and the
operator advances it in the Medusa admin ([ADR-0027](docs/adr/0027-medusa-owns-the-order-the-bot-only-notifies.md)).
An Order also produces a Lead so the conversation has a home, but that Lead's
status is not the Order's state.

**Order marker** — the claim one delivery attempt takes on an Order, so that
only the attempt holding it stores the Order's Lead. Taken before the Lead is
stored and never given back, which is what keeps a retried delivery from
storing a second Lead ([ADR-0022](docs/adr/0022-orders-reach-the-bot-through-a-signed-hook.md)).

**Product type** — a kind of part (batteries, motor oils, filters, brakes). A
type declares which fields a product of that kind has, which of them filter,
which show on the card and which get their own landing page. One declaration,
not four copies.

**Spec** — the attribute values of one product, keyed by its type's fields.

**Fitment** — the set of cars a product fits, as make/model/year entries, typed
by the admin as free text and checked for shape only. There is no vehicle
dictionary to join them against, and none until a product type with required
fitment ships ([ADR-0028](docs/adr/0028-no-vehicle-dictionary-until-fitment-is-required.md)).

**Landing page** — a page for one value of one field ("batteries, 60 Ah"),
built only when enough products fall under it to be worth a page.

**Reserve window** — how long an unpaid, uncollected Order keeps the stock it
reserved. Past it the order is cancelled outright, which is what frees the
reservation. The buyer is told the window in the order email.

**Installation** — a service sold alongside a part (fitting a battery, changing
pads). Priced per type of part, not per product.

**Catalog version** — a counter Medusa bumps on every catalog write. The
storefront is static, so this is what says a built site has gone stale
([ADR-0020](docs/adr/0020-static-storefront-rebuilt-on-catalog-version.md)).

**Shop status** — `off`, `preview` or `live`: whether the shop's pages are built
at all, built but hidden and unindexed, or public
([ADR-0025](docs/adr/0025-shop-status-and-dev-preview.md)).

## Content

**Source locale** — the language content is authored in (`ru`). Not the language
a site presents by default; that is the site's **primary locale**.

**Hand-written translation** — a translation a person wrote instead of the
model. It is adopted and served, but only while the file's Russian source is
unchanged.
