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

**Contact click** — a Lead created by tapping a WhatsApp, Viber, phone or
Telegram tile rather than by submitting a form. It carries a channel and no
message. A Telegram tile opens the brand's own bot, and the Contact click it
stores is a placeholder the bot's own Lead absorbs on `telegramId`
([ADR-0030](docs/adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).
A Telegram tile that opens a human account — no `?start=` in its link, which
on approved.rs is the `/thanks/` tile when `PUBLIC_TG_MANAGER` is set — stores
no Contact click: the visitor already has a Lead, and no bot will come to
absorb a placeholder.

**Ghost lead** — a Contact click on a channel whose outcome we cannot observe
— WhatsApp, Viber or the phone — that never gained a contact: still the
placeholder contact, still `new`, and older than the retention window. Nothing
on our side can tell whether the person wrote, so a Ghost lead retires itself —
the daily reminder cron marks it lost
([ADR-0029](docs/adr/0029-ghost-leads-retire-themselves.md)). Because the sweep
runs daily against a 24-hour window, a Ghost lead actually lives 24 to 48 hours.

**Capture bot** — one per brand, and the whole of that brand inside Telegram:
a visitor can read its services and answer its Questionnaire without opening
the site. It writes a Lead on every `/start`, and every change it makes to
that Lead reaches the admin the same way an owner's edit does. It has no
owner surface; the owner answers from their own account, or through it
only for a visitor who has no username.

**Questionnaire** — the short set of questions a Capture bot asks to turn a
Lead into a request the owner can answer. Each brand has its own. Leaving
it for the menu ends it, and the answers given so far stay on the Lead.
_Avoid_: wizard, form (the site's form is a different thing)

**Owner** — the business partner who serves the clients the sites bring and
owes the admin a Payout for them. Not the owner of the sites.
_Avoid_: operator, partner, manager

**Admin** — the person who builds the sites and supplies the Leads; the one
Payouts are owed to.

**CRM bot** — the single bot the owner and the admin work in: cards, statuses,
money, reminders and order notifications, for all three brands in one chat.

**Payout** — an amount the owner owes the admin for one piece of work: a
deal, a repeat visit, an upsell. The owner states the amount; nothing derives
it from a rate or a profit. A Lead can carry several Payouts, and a Payout can
belong to no Lead, in which case it need not name a Brand either. A Payout recorded before a
Settlement is settled, whether or not that Settlement covered all of it.
_Avoid_: commission, income, profit, share

**Draft Payout** — a Payout the bot read from an owner message, shown for the
owner to confirm, fix or discard; it owes nothing until confirmed.

**Settlement** — an amount the admin has received from the owner. The
balance owed is all Payouts minus all Settlements, so a partial payment simply
leaves the rest owed.
_Avoid_: payment confirmation, paid flag

## Shop

**Order** — a purchase in Medusa. Medusa is its only source of truth: its
status, its fulfillment and its inventory reservation all live there, and the
owner advances it in the Medusa admin ([ADR-0027](docs/adr/0027-medusa-owns-the-order-the-bot-only-notifies.md)).
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

**Case study** — one finished deal shown as proof: the car, the price paid and
the outcome. Visitors see it as a «реальная сделка»; "case study" is the name in
code and in this glossary. The brand sites call theirs works.
_Avoid_: case (bare), кейс in visitor copy.

**Browsing depth** — how many distinct Case studies one visitor has opened in
one visit, the current one included. A visit ends after 30 minutes without
opening another, the same length as Metrika's visit timeout.

**Hand-written translation** — a translation a person wrote instead of the
model. It is adopted and served, but only while the file's Russian source is
unchanged.
