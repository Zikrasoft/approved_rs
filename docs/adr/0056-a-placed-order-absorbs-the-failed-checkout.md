# A placed Order absorbs the Failed checkout before it

Every refused or unreachable checkout on carlab.rs stores a `parts-order` Lead without an order id, a Failed checkout, so a contact typed into the cart is never lost. Most refusals (a changed price, a changed cart) are fixed by the visitor in seconds on the same page, and the order that follows used to post a second card while the first stayed open asking staff to call someone who had already ordered.

We keep the Lead for every refusal and merge instead. `mergeTarget` in `@podbor/lead-crm`'s `store.ts` names the rule (`isFailedCheckout`: a standalone service with no order id): a `parts-order` Lead, failed or placed, lands on an open, Fresh Failed checkout of the same brand with the same visitor id or the same real contact. A second failure adds its lines to the first; a placed Order takes it over with its order id, contact, name and summary, and the reason line stays above as a note. A Failed checkout that is closed or past the merge window stays apart, and a placed Order still never merges into another placed Order or into a non-order Lead.

This amends [ADR-0045](0045-offer-cart-closed-beta-order-lead.md)'s "every order is its own card": every placed Order still is.
