# Analytics: what we measure and how to keep it honest

The goal is to answer "what changed after what we did" with numbers rather than
impressions. Before this, only visits and the fact of a form submission were
measured, so a drop in conversion could not be told apart from a change in the
traffic mix.

GA4 replaced Yandex Metrika on 2026-10-14 — [ADR-0033](../adr/0033-google-analytics-instead-of-yandex-metrica.md),
superseding [ADR-0012](../adr/0012-yandex-metrica-only-starting-before-consent.md). All
history before that date is in Metrika only; see
[Breaks in the series](#breaks-in-the-series) for the final snapshot.
Metrika came back beside GA4 on 2026-10-23
([ADR-0044](../adr/0044-yandex-metrika-beside-ga4.md)): every goal reaches both,
under the same identifier, and Webvisor records sessions again with the lead
forms masked by `METRIKA_MASK_CLASS` from `@podbor/site-kit/browser`.

Exclusions from the sample (our own visits, Russia) are in
[analytics-exclusions.md](analytics-exclusions.md). Without them, any conversion
figure is roughly doubled.

## One place for event names

`packages/site-kit/src/goals.ts` is the single source of truth. The identifier is
written there once, all three sites take it from there, and exactly that string is
marked as a key event in the matching GA4 property. There should be no `'form_view'`
literals in the apps.

`packages/site-kit/src/funnel.ts` wires everything up from
the markup and is armed by `bootSiteKit` from each app's layout. Contact clicks live
separately in `contactClick.ts`, because they also write a lead to the server.

## Event vocabulary

Names follow the GA4 convention — a verb about what the person did, in snake_case.
Variants go into parameters, not into new names.

| identifier                                                       | when                                            | parameters                                        |
| ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `scroll_50`                                                      | scrolled half the page                          | —                                                 |
| `scroll_90`                                                      | read to the end of the page                     | —                                                 |
| `form_view`                                                      | the form entered the viewport                   | —                                                 |
| `form_start`                                                     | first input into the form                       | —                                                 |
| `form_error`                                                     | the submission was rejected                     | `field`: `telegram`, `phone`, `consent`, `server` |
| `form_submit`                                                    | the server took the lead                        | `service`                                         |
| `contact_click`                                                  | clicked a phone number or a messenger           | `channel`, `placement`                            |
| `lead_modal_open`                                                | opened the form in the modal (approved.rs only) | `tab`, `service`                                  |
| `telegram_choice`                                                | picked bot or manager after a Telegram tap      | `option`: `bot`, `manager`                        |
| `brand_link_click`                                               | left for a partner site (approved.rs only)      | `brand`: `details`, `carlab`                      |
| `lang_offer_shown` / `lang_offer_taken` / `lang_offer_dismissed` | the language-choice banner                      | `from`, `to`                                      |
| `case_view`                                                      | opened a Case study                             | `depth`: Case studies opened this visit           |
| `developer_credit_click`                                         | clicked the Zikrasoft credit in the footer      | —                                                 |

`scroll_50`, `form_view` and `form_start` fire once per page rather than once per
form: the approved.rs homepage has three forms, and counting them separately would
triple the numerator.

**JS events do not deal with anything visible from the URL.** A service-page view
and the thank-you page are registered as URL-based key events in GA4 directly —
duplicating them in code is pointless.

`form_start` counts input, not focus. The modal puts the cursor in the first field
itself, so on focus the goal would fire on every opening, duplicating
`lead_modal_open`. Filling something in means typing.

## The markup everything hangs off

| attribute                | on what                        | for what                          |
| ------------------------ | ------------------------------ | --------------------------------- |
| `data-lead-form`         | the enquiry `<form>`           | view, start, error, submit        |
| `data-contact-channel`   | phone and messenger controls   | `contact_click` and a server lead |
| `data-contact-placement` | the region the control sits in | `placement` in `contact_click`    |
| `data-brand-link`        | links to partner sites         | `brand_link_click`                |
| `data-developer-credit`  | the Zikrasoft footer credit    | `developer_credit_click`          |
| `aria-invalid="true"`    | a field that failed validation | the field name in `form_error`    |

`data-contact-placement` names where on the page the control sits, never which
component renders it: `hero`, `bar`, `floating`, `footer`, `header`, `thanks` —
one word can therefore be stamped by several components (`bar` is every full
contact bar, wherever it is rendered) and `thanks` is a whole page, because that
page is one region. The closed set is `CONTACT_PLACEMENTS`
in `packages/site-kit/src/goals.ts`, stamped through `contactRegion()` in
`@podbor/site-kit/contact-control` so a typo is a build error. It goes on a container, and the tracker reads the nearest
one above the tapped control, so one attribute covers a whole bar. A rename of
the component that renders a region must not move the word, or a year of data
splits in two. `placement` rides on the existing goal, so there is nothing to
create in the three counters.

`aria-invalid` is set and cleared only through `markFieldValidity` from
`@podbor/site-kit/browser` — three forms used to do it three different ways. The
tracker reads that attribute to know the submission was rejected, and `data-field`
to know which field is to blame. A form that marks an error with a class alone gets
no `form_error`. `aria-invalid` is also read by screen readers, so it has to be
cleared as soon as the visitor fixes the field.

## How an ad visit is recognised

`rememberAdTouch` in `packages/site-kit/src/adTouch.ts`, armed by
`bootSiteKit`, reads the landing URL. It is an ad when the URL carries
`fbclid` or `gclid`, or `utm_medium` is `paid`, `cpc`, `ppc` or `paid_social`
(any case). The source is `utm_source`, else `facebook` for `fbclid` and
`google` for `gclid`, else none; `utm_medium`, `utm_campaign` and
`utm_content` ride along. The first
such landing is kept in `localStorage` for 30 days and never overwritten while
it is fresh; a visitor who declined analytics stores none, and declining
clears it. Every Lead the site then creates carries it, and the CRM card shows
«📣 Реклама: Facebook · <campaign> · <content>» with `#реклама`; a visit only
its `utm_medium` identifies shows a bare «📣 Реклама», never the raw medium.

Tag every ad link with UTM even where the network adds its own click id:

```
?utm_source=facebook&utm_medium=paid&utm_campaign=<campaign>&utm_content=<ad>
```

`utm_medium=paid` is what makes a link an ad when the click id is stripped.
Keep source, campaign and content to letters, digits, spaces and
`._-+|:/()&,#`, at most 100 characters each. Anything else is stripped from
the value, in the browser and again on the server (`cleanAdText` in
`packages/lead-crm/src/adText.ts`); a field left empty is dropped, and the
visit only when none of source, medium, campaign or content is left. Instagram placements bought through Meta are
`utm_source=instagram`.

## How a form submission is counted

All three forms post through `submitLeadForm` from `@podbor/lead-crm/submit`,
which fires `lead-form-result` on the form with whether the server took the
lead. `form_submit` hangs off that event, so it counts leads the server
accepted rather than times the button was pressed — a submission the server
refuses is counted as `form_error` with `field: server` instead.

The submit handler sits on `document` in the bubbling phase rather than on the
form itself: by that point all the form's own listeners have run and the
`aria-invalid` markers are final.

- the submission carries an `aria-invalid` → `form_error` with the field name;
- the server took it → `form_submit` with the service;
- the server refused it, or the connection dropped → `form_error` with
  `field: server`;
- the form carries `data-awaiting-kit` → stay quiet. That attribute is set by
  `deferSubmitUntilKit` from `@podbor/lead-crm/phone-kit` while
  `libphonenumber-js` is still loading; the form will resubmit itself a moment
  later. The signal comes from the form itself rather than being guessed from an
  absence of markers.

## The funnel

The measurement ids are in [deploy.md](deploy.md), to avoid keeping a third copy.
Each property has a Funnel Exploration, **"ENQUIRY FUNNEL: saw → started →
submitted"** (`form_view` → `form_start` → `form_submit`). A funnel only counts a
step if every step before it happened in the same session.

Marked as key events by hand in all three GA4 properties: the four form steps, the
two reading events, `contact_click`, the three language-banner events, a URL-based
key event on `/thanks/`. On approved.rs there are additionally `lead_modal_open`,
`brand_link_click` and the URL key event "Interest — a service page or a case
study". `developer_credit_click` is deliberately **not** a key event anywhere: it
is a click to the studio that built the site, not a step toward a lead, and
counting it would inflate conversions. The funnel exploration itself is a saved report, not a key event, and is
rebuilt by hand per property.

GA4's Enhanced Measurement (automatic `scroll`, `click`, `page_view`, …) is left on
for all three properties: it counts overlapping things independently of our code
and serves as a cross-check, the same role Metrika's automatic goals played.

## The CarLab shop

carlab.rs sells parts from a live-quoted offer cart
([ADR-0045](../adr/0045-offer-cart-closed-beta-order-lead.md)), still in closed
beta. `GOALS.addToCart` / `beginCheckout` / `purchase` (`add_to_cart`,
`begin_checkout`, `purchase`, GA4's standard ecommerce event names) and their
row in `META_EVENTS` (`packages/site-kit/src/analytics.ts`) stay in the shared
vocabulary but are not fired yet: the cart and checkout reach no `reachGoal`.
When the shop opens (`SHOP_OPEN=true`), wire these same goals from the offer
cart's `items[]` / `value` / `currency` (`rsd`) rather than invent new event
names, and mark them as key events in the GA4 property at the same time.

## Meta Pixel

Every goal goes through `reachGoal`, which reaches GA4, Metrika and, on a site with a
pixel id, the Meta Pixel. The pixel shares the Google tag's gate in
`packages/site-kit/src/analytics.ts`: never in dev, never under a refusal, queued
on the first page view (`init` + `PageView`) with `fbevents.js` fetched while the
browser is idle. There is no `<noscript>` image: the sites count nothing without
JavaScript anyway.

Only goals with a Meta standard event reach the pixel — `META_EVENTS` in the same
file is the one table:

| Goal             | Meta event                                      |
| ---------------- | ----------------------------------------------- |
| `form_submit`    | `Lead`                                          |
| `contact_click`  | `Contact` (every channel)                       |
| `add_to_cart`    | `AddToCart`                                     |
| `begin_checkout` | `InitiateCheckout`                              |
| `purchase`       | `Purchase`, with `value` and `currency` (`RSD`) |

The rest (scroll depth, form steps, language offer, case views) stay in GA4 and Metrika: an
ads optimiser learns nothing from them and custom events only clutter Events
Manager. To send one, add its row to `META_EVENTS`. Parameters other than
`value` + `currency` never reach Meta.

The pixel id sits beside the GA4 measurement id in each app's
`src/utils/analytics.ts` as `META_PIXEL_ID` and is passed to `bootSiteKit` by the
layout. carlab.rs has `29229430643330595`; approved.rs and details.rs are
`undefined`, so no pixel loads there. To add one, set the constant, and update
that site's privacy copy and `COOKIE_POLICY_VERSION` (see [deploy.md](deploy.md))
in the same change.

### The server `Lead` event from a Capture bot

The pixel cannot run inside Telegram, so a visitor who goes from the site to a
Capture bot and leaves a request there is reported to Meta by the server,
through the [Conversions API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api).

**What the site keeps.** Every contact-click beacon and every lead form posts
`meta_ids` beside `ad_source`: the `_fbc` and `_fbp` cookies the pixel set, or,
without `_fbc`, an fbc built from the `fbclid` of the first Ad visit as
`fb.1.<landing time in ms>.<fbclid>`, the fbclid unmodified — Meta's own
[recipe](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc).
Under a refusal nothing is sent, the same gate as the pixel
(`storedMetaIds` in `packages/site-kit/src/adTouch.ts`). The Lead stores them
as `metaIds`, zod-checked against the `fb.<n>.<time>.<value>` shape; a Capture
bot Lead that absorbs the click inherits them, and the first one wins.

**When it fires.** Once per Lead, when the bot request becomes real: the
Questionnaire is completed, or the visitor shares a phone, whichever comes
first. A bare `/start` sends nothing. The Lead's `metaLeadSentAt` is set in the
same compare-and-swap write that claims the event (`claimMetaLead`), so a second
completion, a second phone or a retry never sends it again. A Lead without
`metaIds` (the visitor never came through the site, or refused) sends nothing.

**What is sent** (`packages/lead-crm/src/metaConversions.ts`), `POST
https://graph.facebook.com/v25.0/<pixel id>/events` with a form-encoded body:
`access_token`, `data` (the JSON array below) and, while testing,
`test_event_code`. The token rides in the body, as the form-field form of
Meta's own example request does
([using the API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api)),
rather than in the query string, so a logged URL or a fetch error never
carries it. `data` decoded:

```json
{
  "data": [
    {
      "event_name": "Lead",
      "event_time": 1760261400,
      "event_id": "lead-42",
      "action_source": "chat",
      "user_data": { "fbc": "fb.1.…", "fbp": "fb.1.…" }
    }
  ]
}
```

- `action_source: "chat"` — "Conversion was made via a messaging app, SMS, or
  online messaging feature"
  ([server event parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event)).
  `event_source_url` and `client_user_agent` are required only for `website`
  events ([best practices](https://developers.facebook.com/documentation/ads-commerce/conversions-api/best-practices)),
  and we have neither for a chat, so neither is sent.
- `event_time` is the moment of the claim, in seconds; Meta refuses one older
  than 7 days, which a request sent at once never is.
- `event_id` is `lead-<Lead id>`, stable for dedup.
- `user_data` carries `fbc`/`fbp` only, unhashed as Meta asks
  ([customer information parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)).
  **No phone, email, name or any hashed contact** — an owner decision, so
  `external_id` is not sent either.
- `test_event_code` is added only while `META_CAPI_TEST_CODE` is set.
- `v25.0` is the version Meta's own examples use; `META_GRAPH_VERSION` holds it.

The call is fire-and-forget through `waitUntil`, after the visitor's reply, with
a 5 s timeout; a refusal or a network failure is logged as `[meta-capi]` and
never retried. Without `META_CAPI_TOKEN` or a pixel id the app logs
`[meta-capi] off` once per cold start and sends nothing. Whether Meta attributes
a `chat` event that carries only `fbc`/`fbp` well enough to optimise on is not
established ([research](../research/meta-ads-to-telegram-capture-bot.md)).

**Verify.** Set `META_CAPI_TEST_CODE` to the code from Events Manager → the
pixel → **Test events**, redeploy, open the site from a URL with `?fbclid=test`,
tap the Telegram tile and finish the Questionnaire: the `Lead` with source
"Server" appears in the Test events tab within a minute. Remove the variable and
redeploy afterwards — Meta says test codes must not ride on production events.

## How to add an event

1. Add the identifier to `GOALS` and call `reachGoal` where it happens.
2. Cover it with a test: `packages/site-kit` holds a 100% gate and CI will fail
   without one.
3. Mark it a key event by hand in **all three** GA4 properties: Admin → Events,
   wait for the event to appear after it fires once, then toggle "Mark as key
   event". The event must be seen by the property before the toggle exists —
   fire it once from a build (not `pnpm dev`) first.

An event registered in code but not marked as a key event is counted nowhere in
conversion reporting and lost silently — it is the most common way to end up with
no data.

## What these numbers will not show

Moving between sites breaks the session: going from approved.rs to details.rs means
a different domain and a different property, where the person is already a new
visitor with approved.rs as the referrer. `brand_link_click` is the only place that
transition is visible from approved.rs's side.

To see which partner the visitor left for, open the approved.rs property (the
other two never fire this event), take the event `brand_link_click` and group it
by the parameter `brand`: one row for `details`, one for `carlab`. The
language banner keeps `from` / `to`, so grouping by `to` would mix locale codes
into the same report. Apply the standing exclusions from
[analytics-exclusions.md](analytics-exclusions.md) before reading the numbers.

Nothing from a dev server. All three layouts pass `analytics: false` to `bootSiteKit` when
`import.meta.env.DEV`, so no Google tag is loaded locally and `reachGoal` is a
no-op — verify an event against a build (`pnpm build`, then
`pnpm --filter <app> preview`), never against `pnpm dev`. A preview serves the
production build and so does report to the real property, from `127.0.0.1`; GA4's
"Internal traffic" / "Developer traffic" data filters are what keep that out of
reports, once configured the same way the exclusions doc describes.

`form_view` rests on IntersectionObserver and needs the tab to be painting frames.
In a background tab the event never arrives — harmless for real visits, but when
verifying through browser automation the tab has to be in the foreground.

## Breaks in the series

A goal with history must not be redefined quietly — a before-and-after comparison
would lie. What is already broken:

| date                   | goal                                        | what changed                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-16             | the automatic "phone number click" goal     | the goal was created; before that date it is zero by definition                                                                                                                                                                                                                                              |
| 2026-09-23 (`a65f421`) | `contact_click` on carlab.rs and details.rs | it used to count only phone numbers and messengers, and now counts any `[data-contact-channel]`, including buttons that open the form. The series steps up. On approved.rs unchanged                                                                                                                         |
| 2026-10-02             | `lead_modal_open` on approved.rs            | messenger tiles stopped opening the form ([ADR-0015](../adr/0015-lead-form-asks-only-for-a-contact.md), issue #56), so the goal lost every messenger tap. The series steps down; `contact_click` is unaffected, and the contact-click Leads in the CRM step up by the same taps                              |
| 2026-10-02             | `form_submit` on all three sites            | it used to fire on a submission attempt and now fires only once the server has taken the lead (issue #54). The series steps down by whatever share of attempts was failing, and the drop is the number worth knowing                                                                                         |
| 2026-10-02             | `form_submit` on all three sites            | a honeypot hit still answers with the same redirect as an accepted lead, so a bot that trips it is counted as a conversion. Pre-existing — the native submit counted it too — and left alone so the trap keeps looking like success                                                                          |
| 2026-10-02             | `contact_click` on approved.rs              | it no longer counts a control that merely opens the lead form — only the channels that reach a person (`phone`, `telegram`, `whatsapp`, `viber`), which is what `lead_modal_open` already counts. By then approved.rs was the only site still stamping a non-channel control, so only its series steps down  |
| 2026-10-06 (this PR)   | `brand_link_click` on approved.rs           | the partner destination moved from the parameter `to` to `brand`, so it no longer shares a key with the language banner's locale codes (issue #115). The goal itself is unchanged; a report crossing the date sees `to=details` / `to=carlab` before it and `brand=details` / `brand=carlab` after           |
| 2026-10-06 (this PR)   | `contact_click` on carlab.rs                | the homepage and service-page heroes gained a call / Telegram / WhatsApp row under a new `hero` placement, next to the booking door (issue #123). The series steps up from the zero baseline recorded on #123; `form_submit` and the `/thanks/` goal are compared against that same baseline two weeks later |
| 2026-10-14             | every goal, all three sites                 | Yandex Metrika replaced with GA4 ([ADR-0033](../adr/0033-google-analytics-instead-of-yandex-metrica.md)). Every series restarts from zero in the new properties — there is no automated history import. `order_placed` is renamed `purchase` and gains GA4's standard `items[]` shape                        |
| 2026-10-20             | `telegram_choice`, all three sites          | a Telegram tile that opens the bot now asks bot or manager first ([ADR-0042](../adr/0042-telegram-tap-offers-bot-or-manager.md)); `contact_click` still fires on the tap itself, so taps minus picks is the share that closed the dialog                                                                     |
| 2026-10-23             | every goal, all three sites                 | Yandex Metrika restored beside GA4 ([ADR-0044](../adr/0044-yandex-metrika-beside-ga4.md)). The counters resume their pre-2026-10-14 series with a nine-day gap; `purchase` replaces `order_placed` there and carries `order_price` for revenue                                                               |

### Final Metrika snapshot before cutover

Pulled 2026-10-14, `run_report` over 2026-09-14 → 2026-10-13 (the 30 days before
cutover), `ym:s:regionCountryName!='Россия'` applied. The owner/partner clientID
list (`.local/analytics-exclusions.txt`) is **not** reflected here — the
Reporting API has no clientID filter (see
[analytics-exclusions.md](analytics-exclusions.md#how-to-apply-it)), so these
numbers are still inflated by that known share, same as every other Metrika
report that was not built through the Logs API by hand.

| site        | visits | users | form submits | contact clicks |
| ----------- | -----: | ----: | -----------: | -------------: |
| approved.rs |    343 |   244 |           20 |             86 |
| carlab.rs   |    129 |   110 |            0 |              4 |
| details.rs  |     79 |    67 |            0 |              1 |

This is the last pre-cutover reference point; the Metrika counters are not
deleted by this change, so a deeper pull through the Logs API (with the
clientID exclusion properly applied) is still possible later if a precise
before/after comparison is ever needed.
