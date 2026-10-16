# Podbor

A monorepo of three independent brand sites (approved.rs, details.rs, carlab.rs) plus their shared lead-capture machinery. This glossary currently only holds terms from the CarLab parts-shop rebuild effort; broader site-wide vocabulary (Lead, Brand, etc.) lives in `CONTEXT.md` and is referenced here, not duplicated.

## Language — CarLab parts shop

**Part**:
A catalog item a customer can order for a vehicle (a specific brake-pad set, an oil filter). CarLab holds none in stock; a Part exists in the catalog by its Supplier article number.
_Avoid_: Product (carries Medusa/e-commerce baggage this rebuild is leaving behind), SKU (an implementation detail, not the business concept).

**Fitment**:
The compatibility relationship between a Part and a vehicle, resolved either from a VIN or from a chosen make/model/engine.
_Avoid_: Compatibility (vaguer), Vehicle dictionary (ADR-0024's parked, Medusa-era mechanism — not this).

**VIN Lookup**:
Searching the catalog by a vehicle's VIN or chassis number to resolve its Fitment and list the Parts it takes.
_Avoid_: VIN decode (a lower-level step inside this, not the feature itself).

**Supplier**:
A source of price and stock for a Part — an external wholesaler (e.g. Inter Cars RS, and room for a second one later) or CarLab's own stockroom, modeled the same way. CarLab does not warehouse Parts as a rule, but popular Parts it has deliberately bought ahead of demand are still a Supplier in this model — "CarLab" itself — whose Supplier Offers are entered by staff rather than read from a live API.
_Avoid_: Vendor, distributor.

**Supplier Offer**:
One Supplier's price and stock/availability for one Part, each refreshed on its own schedule (live API, a cached pull, or a staff-entered figure for CarLab's own stock). A Part can carry more than one Supplier Offer at once — that's the normal case, not an edge case, once a second external Supplier exists alongside Inter Cars RS and CarLab's own stock.
_Avoid_: Listing, inventory record.

**Markup**:
The margin CarLab adds on top of a Supplier Offer's price to produce the price a customer sees. Set per Supplier (own-stock Offers carry a higher rate than an ordered-in Offer, reflecting the difference between "ready today" and "wait for it" — an admin setting, never hardcoded), and never disclosed to the customer in any copy, UI, or receipt — to them it looks like a normal price with a stated wait, not a markup over some other price.
_Avoid_: Margin (fine informally, but Markup is the one name this glossary uses), commission (this repo already uses "commission" for a different thing — partner payouts — elsewhere; do not reuse it here).

**Order** _(new concept, distinct from Lead)_:
A customer's commitment to buy one or more Parts at a fixed, already-marked-up price, paid in cash on pickup or online, fulfilled once CarLab has the Parts ready for collection (already in its own stock, or bought in from a Supplier). Its source of truth lives in the new system's own store, not in the existing Lead store — the same shape the old Medusa-era Order had (`docs/adr/0027-medusa-owns-the-order-the-bot-only-notifies.md`): placing an Order also creates a companion Lead in `packages/lead-crm` purely so the Telegram notification/conversation has a home, but that Lead is never the Order's source of truth.
_Avoid_: Purchase (ambiguous with CarLab's own purchase from a Supplier), Cart (not yet modeled), Lead (a sales inquiry — see `CONTEXT.md` — never an Order).

**Admin** _(in this effort's context)_:
The staff user of the new catalog/order web panel. Distinct from the existing Telegram lead-crm bot's owner/manager persona, which stays scoped to leads and contact clicks only.
_Avoid_: Operator (used elsewhere in this repo for the Medusa shop's staff — that shop is being deleted).

**Location**:
A physical CarLab auto-service site a customer can pick an Order up from, and where CarLab's own stock physically sits. There is one today; a second is a real but distant possibility with no timeline. Order and the CarLab Supplier's own stock each carry a Location from the start — a column kept at a single value for now rather than added later by migration — but nothing else (Admin scoping, per-Location views) is built ahead of a second Location actually existing. An external Supplier's own branch network (Inter Cars RS has several, by the stock research) is that Supplier's internal concern, not modeled here — CarLab reads one summarized price/availability answer from a Supplier, never asks which of their branches it came from.
_Avoid_: Branch (used here for a Supplier's own internal warehouse network, e.g. Inter Cars RS's — keep the two distinct: a Supplier has Branches CarLab never models; CarLab has Locations).
