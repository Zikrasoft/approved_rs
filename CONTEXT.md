# Context

Glossary for this repo. Terms only — no implementation detail, no decisions.
Decisions live in [`docs/adr/`](docs/adr/), conventions in
[`AGENTS.md`](AGENTS.md).

## Lead capture

**Lead** — one request from one visitor, stored once and owned by exactly one
brand. A form submission and a contact click both become Leads. A Lead's
`status` describes the **conversation** with that person, never the state of
anything they bought: new (🆕 Новая), negotiations (🗣 Переговоры, the owner
is talking to the visitor), in progress (🔵 В работе), postponed (⏸️ Отложена),
and the two outcomes, won (✅ Успешно) and lost (❌ Отказ), that close it. New,
negotiations and in progress are **in work**: the open list, search, the
7-day digest and postponing treat them alike.

**Negotiations** — a Lead the owner is already talking to. Set by hand with 🗣
on the CRM card, and on its own the first time the owner or the admin replies
to a new Lead's visitor through the bot. Never a Ghost lead.

**Postponed** — a Lead the owner or the admin set aside until a date with ⏰ on
the card or the detail. On that day it goes back to the status it was postponed from (new
when none is recorded), the owner gets a DM reminder and the group digest lists
it.

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
placeholder contact, still new with no owner activity, and older than the
retention window. Mostly WhatsApp, Viber or the phone, whose outcome we cannot
observe, but the channel does not matter: a Telegram-tile click whose visitor
never pressed Start in the bot has no bot Lead to absorb it, and retires the
same way. A Capture bot Lead is never a Ghost lead, a bare `/start` on the
`tg://user?id=…` contact included: the owner can still reach that visitor
through the bot. Nothing on our side can tell whether the person wrote, so a Ghost
lead retires itself — the daily digest cron marks it lost
([ADR-0029](docs/adr/0029-ghost-leads-retire-themselves.md)). Because the sweep
runs daily against a 24-hour window, a Ghost lead actually lives 24 to 48 hours.

**Failed checkout**: a `parts-order` Lead with no order id: carlab.rs's
checkout refused the cart or could not reach the shop, so it stores the
contact, the reason («Заказ не оформлен: …») and the cart lines instead of an
Order. Every refusal stores one, even one the visitor fixes on the same page.
While it is open and Fresh, the next checkout of the same visitor or contact
lands on it: another failure adds its lines, and a placed Order absorbs it,
taking the order id, the contact and the summary, with the reason left above
as a note. So a retry never leaves a second card asking staff to call someone
who already ordered
([ADR-0056](docs/adr/0056-a-placed-order-absorbs-the-failed-checkout.md)).
_Avoid_: abandoned cart, failed order

**Visitor activity** — the last time the visitor did something on a Lead
through a Capture bot: pressed Start, answered, wrote (`visitorActiveAt`).

**Owner activity** — the last time the owner worked the Lead in the CRM bot:
marked it in work, added a note, edited its name or contact, answered
a prompt on it, wrote to the visitor in its Topic (`lastActivityAt`). An edit
or note by the admin counts the same.
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

**Ad visit** — the first time, in the last 30 days, this browser landed on the
site from a paid ad: a `fbclid` or `gclid` in the URL, or `utm_medium` of
`paid`, `cpc`, `ppc` or `paid_social`. Kept in the browser beside the visitor
id and under the same consent, and sent with every Lead the site creates —
form or Contact click. It lands on the Lead as `adSource` (source, medium,
campaign, content, when); a Capture bot Lead that absorbs a Contact click inherits it,
and on a merge the first one wins. The card, the detail and the Topic summary
show it as «📣 Реклама» with `#реклама`. A visitor who reaches a Capture bot
without passing through the site has no Ad visit: ads send people to the site.

**Meta Lead event** — the one `Lead` the server reports to Meta's Conversions
API for a Capture bot Lead, since the pixel cannot run in Telegram. It fires
once, when the bot request becomes real (the Questionnaire is completed or the
visitor shares a phone), and only for a Lead carrying the Meta browser ids
(`metaIds`: `fbc`/`fbp`) the site sent with consent. It carries those ids and
nothing about the person. `metaLeadSentAt` on the Lead marks it sent.

**Capture bot** — one per brand, and the whole of that brand inside Telegram:
a visitor can read its services and answer its Questionnaire without opening
the site. It writes a Lead on every `/start`, and copies everything else the
visitor sends — answers, free text, a shared phone, photos, voice, files —
into the visitor's Topic as it arrives; a visitor with no Lead yet gets one
first, and a Lead from before Topics gets its Topic then. It has no owner
surface of its own: the owner answers in the Lead's Topic, and the Capture
bot copies each message to the visitor, username or not. Its menu ends with a
blue «Написать менеджеру» (CarLab and Details: «мастеру») tap. Where the brand
names a staff account it is a manager hand-off: the first tap stamps
`managerHandoff` on the visitor's Lead — even once the Questionnaire is
finished — shows it on the card and posts it to the Topic, then turns the menu
into a link to that account; with no account named it stays the in-bot
question screen.

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
conversation, and only for a Lead that came through a Capture bot in
Telegram. Telegram is one convenient channel, not the only one: a Lead from
WhatsApp, Viber, a phone call or the site form has no Topic and no relay, and
nothing about a Lead may assume it has one. The CRM bot opens it the first time a Capture bot touches a
Lead the visitor started from Telegram, names it after the Lead's id, name and
brand (renamed when staff correct the name), and keeps the Lead summary as its first message, edited as the
Questionnaire fills in. The Lead's card in General and its detail link to it;
a Lead the bot knows (`telegramId`) without one shows «💬 Начать переписку»
there instead, which opens the Topic the same way.
Whatever the owner or admin writes there — text or media — reaches the visitor
through the brand's Capture bot, the first message moves a new Lead into
negotiations, and a copy that cannot be delivered is reported in the Topic.
Open Topics are the clients being worked with: the daily cron closes a Topic
nobody has ever written in — neither the visitor nor the owner — a day after the
Lead was created, a conversation that merely goes quiet stays open, ✅ won and
❌ lost close it, and the next message from either side reopens it before it is
posted. 🗣, 🔵 and ⏰ leave it open, and an edit of the summary is not a message.
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
chat. For every Lead, whatever channel it came from, its card and its detail
in the bot (status buttons, ✏️ Имя, ➕ Контакт, 📝 Заметка) are the
workspace that must always work; either of the two may change a Lead's status
(✅ ❌ 🗣 🔵 ⏰, on the card or the detail; the digest only lists and links), correct its name or give
a Lead without a real contact one, and the other is told what changed and by
whom. Only the admin deletes a Lead. A
real contact — a phone, @username, link or e-mail — is never overwritten: a
second one goes into the notes. The visitor's comment is read-only: staff add
their own text as a note, signed and dated, beside it.

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

## Content

**Source locale** — the language content is authored in (`ru`). Not the language
a site presents by default; that is the site's **primary locale**.

**Case study** — one finished deal shown as proof: the car, the price paid and
the outcome. Visitors see it as a «реальная сделка»; "case study" is the name in
code and in this glossary. The brand sites call theirs works. A CarLab Parts
sourcing case study is drafted from one completed shop Order and shows that
Order's total; other CarLab works carry no price.
_Avoid_: case (bare), кейс in visitor copy.

**Browsing depth** — how many distinct Case studies one visitor has opened in
one visit, the current one included. A visit ends after 30 minutes without
opening another, the same length as GA4's default session timeout.

**Hand-written translation** — a translation a person wrote instead of the
model. It is adopted and served, but only while the file's Russian source is
unchanged.

## Parts shop

The carlab.rs parts shop. These are the words staff and code share; the full
catalogue vocabulary (Vehicle, Category field, Maintenance kit and the rest)
lives in [`GLOSSARY.md`](GLOSSARY.md).

**Part**: one interchangeable thing that does one job on a car, under all its
numbers at once: the car maker's OEM number and every aftermarket brand's
equivalent. Fitments and search point at the Part; nobody buys a Part as such.
_Avoid_: article, SKU, артикул

**Brand-number**: one brand's number for a Part (`PartIdentifier` in code):
OEM (the car maker's number), manufacturer number (the part brand's own
catalogue number) or EAN (the barcode on the box). It is what a customer
buys and what gets its own page; photos and offers belong to it, not to the
Part.
_Avoid_: part number (bare), supplier SKU

**Offer**: one Supplier's price, stock and lead time for one Brand-number
(`SupplierOffer` in code). The site's price is the Offer's purchase price plus
its Supplier's Markup.
_Avoid_: listing, product, variant

**Supplier**: a source the catalogue is imported from: a distributor, a brand
or shop site whose pages are read, or Manual entry. Only a Supplier that sells
to us brings Offers; the rest bring Parts, Brand-numbers and facts alone. Its
import can be switched off, which stops new data but leaves its Offers on the
site until they are taken off.

**Workshop quote**: a CarLab service quote (Serbian «ponuda»): one car's VIN
and the Brand-numbers fitted to it. Staff upload it in the shop admin, check
the Parts and Fitments read from it, and confirm them; its prices are dropped.
_Avoid_: invoice, receipt, order history

**Manual offer**: an Offer staff type in by hand for one Brand-number, under
the Supplier «Ручной ввод» (`manual`). Imports never change or remove it, and
it is removed only one at a time.

**Markup**: the percentage one Supplier's purchase prices are raised by to
give site prices. Set per Supplier, never per Offer.
_Avoid_: margin, commission

**Fitment**: the statement, by staff or a Supplier import, that one Part fits
one Vehicle, with a quantity and, where it matters, a position, dates, steering
side, gearbox or note.
_Avoid_: compatibility, "fits" as a flag

**Requirement**: what an engine, chassis or Vehicle demands of a Category's
Parts (allowed options or a numeric range on one field), e.g. a battery of at
least 80 Ah. Universal Parts reach a car through Requirements; a Fitment that
contradicts one is refused unless staff confirm it.
_Avoid_: spec, recommendation

**Supersession**: a maker replacing a number. Per Brand-number: «снят с
выпуска», the Part still sells under its other numbers. Per Part: «заменена
запчастью», the whole Part now leads to its replacement.
_Avoid_: substitute, cross-reference

**Publish**: the one staff action that puts catalogue changes on carlab.rs:
it translates new texts, rebuilds and deploys the site and refreshes search.
Admin edits and Imports are saved at once but reach the site only on the next
Publish; there is no scheduled run.
_Avoid_: deploy, sync, nightly import

**Import**: one run that reads a single Supplier's catalogue into Parts,
Brand-numbers, Offers and Fitments, started from that Supplier's button and
finished in the background with a report of what it made and skipped. Only one
Import or Publish changes the catalogue at a time; a later Import of the same
Supplier picks up where a failed one left off.
_Avoid_: sync, crawl (a crawl only fetches pages; the Import reads them)

**Add-on service**: a paid service a Category offers next to each of its
Parts in the cart, such as registering a battery in the car's control unit.
Its price is set on the Category, and the order lists it as its own line.
It is one of the two add-on kinds (`ADDON_KINDS`, kind `service`); the other is
Installation at CarLab, defined in GLOSSARY.md.
_Avoid_: upsell, extra, option
