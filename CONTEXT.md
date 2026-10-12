# Context

Glossary for this repo. Terms only — no implementation detail, no decisions.
Decisions live in [`docs/adr/`](docs/adr/), conventions in
[`AGENTS.md`](AGENTS.md).

## Lead capture

**Lead** — one request from one visitor, stored once and owned by exactly one
brand. A form submission and a contact click both become Leads. A Lead's
`status` describes the **conversation** with that person, never the state of
anything they bought: open, negotiations (🗣, the owner is talking to the
visitor), postponed, and the two outcomes, won and lost, that close it.

**Negotiations** — a Lead the owner is already talking to. Set by hand with 🗣
on the CRM card, and on its own the first time the owner or the admin replies
to the visitor through the bot. Not closed: it stays in the open list, the
digest and search like an open Lead, and is never a Ghost lead.

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

**Ghost lead** — a Contact click that never gained a contact: still the
placeholder contact, still open with no owner activity, and older than the
retention window. Mostly WhatsApp, Viber or the phone, whose outcome we cannot
observe, but the channel does not matter: a Telegram-tile click whose visitor
never pressed Start in the bot has no bot Lead to absorb it, and retires the
same way. A Capture bot Lead is never a Ghost lead, a bare `/start` on the
`tg://user?id=…` contact included: the owner can still reach that visitor
through the bot. Nothing on our side can tell whether the person wrote, so a Ghost
lead retires itself — the daily digest cron marks it lost
([ADR-0029](docs/adr/0029-ghost-leads-retire-themselves.md)). Because the sweep
runs daily against a 24-hour window, a Ghost lead actually lives 24 to 48 hours.

**Visitor activity** — the last time the visitor did something on a Lead
through a Capture bot: pressed Start, answered, wrote (`visitorActiveAt`).

**Owner activity** — the last time the owner worked the Lead in the CRM bot:
marked it in work, added a note, answered a prompt on it, wrote to the visitor
in its Topic (`lastActivityAt`).
A status change alone is not owner activity, and neither is a reply sent from
the owner's own Telegram account, which never reaches the store.

**Fresh** — a Lead whose latest of visitor activity, owner activity and
creation is within the last hour. A visitor who comes back to a fresh Lead
continues it — a merged click, a resumed `/start`, a Questionnaire answer, a
free-text message; once it is stale the next one opens a new Lead, and a
Questionnaire left on a stale Lead no longer takes answers. Owner activity
counts so that a conversation the owner is working stays one Lead.

**Referral** — a Lead a sister brand's Capture bot received from the Approved
bot's Partners screen. `referredBy: approved` is the only record of it — the
card renders that field, and no note is written to the comment. Brand and
rate are still the receiving bot's.

**Capture bot** — one per brand, and the whole of that brand inside Telegram:
a visitor can read its services and answer its Questionnaire without opening
the site. It writes a Lead on every `/start`, and copies everything else the
visitor sends — answers, free text, a shared phone, photos, voice, files —
into the visitor's Topic as it arrives; a visitor with no Lead yet gets one
first, and a Lead from before Topics gets its Topic then. It has no owner
surface of its own: the owner answers in the Lead's Topic, and the Capture
bot copies each message to the visitor, username or not.

**Questionnaire** — the short set of questions a Capture bot asks to turn a
Lead into a request the owner can answer. Every brand's opens with «Какие
услуги?»: the brand's services as toggles, a card's service already ticked,
and one action — «Готово →» once something is picked, «Не знаю, нужна
консультация» while nothing is. The picked set lives on the Lead, the first
pick as its primary service; «Не знаю» leaves it empty. The questions after
it are each brand's own. A visitor
with no Telegram username whose Lead has no phone yet is asked for one last,
with no skip — shared from the keyboard button or typed; a visitor with a
username is never asked, the username is the contact. Leaving it for the menu
ends it, and the answers given so far stay on the Lead. Once it is done the
Lead stops changing on what the visitor writes: messages go to the Topic only.
A shared phone is the one exception — it still becomes the contact.
_Avoid_: wizard, form (the site's form is a different thing)

**Topic** — the forum topic in the CRM group that holds one Lead's
conversation. The CRM bot opens it the first time a Capture bot touches a
Lead the visitor started from Telegram, names it after the Lead's id, name and
brand, and keeps the Lead summary as its first message, edited as the
Questionnaire fills in. The Lead's card in General and its detail link to it.
Whatever the owner or admin writes there — text or media — reaches the visitor
through the brand's Capture bot, the first message moves an open Lead into
negotiations, and a copy that cannot be delivered is reported in the Topic.
Open Topics are the clients being worked with: the daily cron closes a Topic
nobody has ever written in — neither the visitor nor the owner — a day after the
Lead was created, a conversation that merely goes quiet stays open, ✅ won and
❌ lost close it, and the next message from either side reopens it before it is
posted. ⏳ and 🗣 leave it open, and an edit of the summary is not a message.
A Lead from the site form or a placeholder click has no Topic until a bot
`/start` merges into it.
_Avoid_: thread, chat

**Owner** — the business partner who serves the clients the sites bring and
owes the admin a Payout for them. Not the owner of the sites.
_Avoid_: operator, partner, manager

**Admin** — the person who builds the sites and supplies the Leads; the one
Payouts are owed to.

**CRM bot** — the single bot the owner and the admin work in: cards, statuses,
money, the daily digest and order notifications, for all three brands in one
chat.

**Payout** — an operation that raises the Balance (➕ Зачислить): an amount
the owner will send the admin. The person recording it states the amount;
nothing derives it from a rate or a profit. It carries no Lead and no Brand,
only an optional note, and either the owner or the admin may record one.
_Avoid_: commission, income, profit, share, credit

**Settlement** — an operation that lowers the Balance (➖ Списать): money that
reached the admin. Either the owner or the admin may record one; one that
would take the Balance below zero is refused.
_Avoid_: payment confirmation, paid flag, debit

**Balance** — all Payouts minus all Settlements: how much the owner owes the
admin right now. Operations are never edited or deleted; a mistake is undone
with an opposite operation. The owner sees it as «Мой долг», the admin as
«Мне должны».
_Avoid_: debt, to pay, ledger total

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
