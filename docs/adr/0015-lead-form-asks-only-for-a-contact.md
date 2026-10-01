# The lead form asks only for a contact; a messenger tap opens the messenger

On all three sites only the contact is required: `@podbor/lead-crm` accepts an empty `name`, and the service picker was removed from the brand forms. A shorter form converts better, and a lead is answerable without a name.

## Amended 2026-10-02: messenger taps no longer route through the form

This ADR originally held that a tap on a messenger tile opens the lead form with the channel preselected instead of leaving the site, because a bare click reaches the operator as a lead with no name and no contact — unanswerable. The CRO audit of approved.rs (2026-09-29, issue #56) priced that detour: in 6 of 18 visits in the window the visitor went hunting for a direct messenger link after a tile labelled «Написать в Telegram» produced a form. The label promised one thing and did another, and every visitor paid the detour while only the share who filled the form paid it back.

So on approved.rs a messenger tile is a plain link to the messenger again, and its Telegram and WhatsApp links carry a prefilled first message in the visitor's locale so the chat does not open empty. Viber's chat link has no prefill parameter, so Viber tiles stay bare — asymmetry by platform, not by choice. The two brand sites always had direct tiles and are untouched here; the prefill lives in the shared link builders as an optional argument, so the second brand to want it has nothing to re-implement. The form keeps four doors on approved.rs: the header CTA, the callback control, the partner block's per-brand triggers and the inline form in the same fold.

The unanswerable-lead cost is paid by [issue #91](https://github.com/Zikrasoft/approved_rs/issues/91) instead: a contact click that never gains a contact retires itself rather than being deleted by hand. The form-fields half of this ADR is unchanged.
