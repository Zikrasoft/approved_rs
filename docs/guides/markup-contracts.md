# Markup contracts

An `ls` will not tell you which **markup contracts** a package owns, and an app
that breaks one fails silently.

## `packages/site-kit`

`packages/site-kit` owns `data-contact-order` / `data-channel` /
`data-primary-contact` / `data-primary-channel` (preferred contact channel),
`data-lead-form` / `data-brand-link` / `data-developer-credit` /
`data-field` / `aria-invalid` (funnel tracking), `data-depth-slug` / `data-depth-door` / `data-revealed` (browsing
depth on case and work pages), `data-search-input` / `data-search-index` /
`data-search-template` / `data-search-results` / `data-search-name` /
`data-search-href` / `data-search-picture` / `data-search-no-picture` /
`data-search-empty` / `data-search-idle` / `data-search-status` (the list
`defineListSearch` searches: the page renders only its own items, the JSON
index carries every item's name, link and picture, and a match is the template
filled into the results list while everything `idle` hides; the status is an
always-present live region it fills with the empty state's text), `data-contact-channel` /
`data-contact-placement` (contact clicks, whose placement half
`.github/scripts/contact-placement.ts` enforces against the built HTML) and
`data-contact-cta` (in-flow contact regions the floating CTA's `watch`
selector hides behind — stamp it with `contactRegion`, `contactCta` and
`CONTACT_CTA_SELECTOR` from `@podbor/site-kit/contact-control`, never as a
literal), `data-vin-input` (the VIN field `defineMyGarage` reads/fills,
`MY_GARAGE_VIN_ATTRIBUTE` from `@podbor/site-kit/browser`, never a literal),
`data-copy-number` / `data-copy-digits` / `data-copy-status` (the number
`defineCopyPhone` copies, the digits it selects when the clipboard fails, the
live region it fills with the copied wording; `COPY_PHONE_*_ATTRIBUTE` from
`@podbor/site-kit/browser`, never a literal, stamped only by each app's
`PhoneNumber.astro`) and
`METRIKA_MASK_CLASS` (on every form that takes a contact, keeping its fields out
of Webvisor recordings as the privacy copy promises; from
`@podbor/site-kit/browser`, never a literal) and `--cookie-consent-height`
(`COOKIE_CONSENT_HEIGHT_VAR` from `@podbor/site-kit/browser`, the banner's
height that `<cookie-consent>` sets on `<html>` and every bar fixed to the
bottom of the screen rises by; Tailwind classes and scoped CSS cannot import
it, so they spell it out and each app's `cookieConsentLift.test.ts` counts the
spellings against the constant).

## `packages/lead-crm`

`packages/lead-crm` owns the `<lead-form>` hooks `leadForm.ts`
picks with a non-null assertion, so a missing one is a `TypeError`:
`data-telegram`, `data-country` (with `data-display-locale`), `data-phone`,
the hidden `contact` and `contact_channel` inputs
(every contact input is named from `CONTACT_INPUT_FIELDS` in
`@podbor/lead-crm/fields`, never a literal: the no-JS refusal page
`createLeadsRoute` renders re-posts every other field as hidden and asks for
these again, under the same privacy line the form shows),
`data-source-url`, `data-visitor-id`, `data-ad-source` (the hidden
`name={AD_SOURCE_FIELD}` input the Ad visit rides in — the contact-click
beacon posts the same field), `data-meta-ids` (the hidden
`name={META_IDS_FIELD}` input for the Meta `fbc`/`fbp`, likewise),
`data-submit-label` inside the submit
button, `data-error-telegram` / `data-error-phone` / `data-error-submit`, tab buttons carrying `data-tab` + `data-panel` +
`aria-selected`, panels carrying `data-panel` alone, and the form's own
`data-submitting-label` and `data-armed`; the busy submit button carries
`aria-busy`, which the apps' spinner CSS keys on. A lead form asks for no
consent: all three sites state the privacy policy in a passive line above the
submit, and the leads route takes a Lead with no `CONSENT_FIELD`. A form that
renders a box (`data-consent` with its `data-error-consent`, only carlab.rs's
checkout, whose `/api/order` still requires it) gets it checked before submit.
