# Analytics: what we measure and how to keep it honest

The goal is to answer "what changed after what we did" with numbers rather than
impressions. Before this, only visits and the fact of a form submission were
measured, so a drop in conversion could not be told apart from a change in the
traffic mix.

Exclusions from the sample (our own visits, Russia) are in
[analytics-exclusions.md](analytics-exclusions.md). Without them, any conversion
figure is roughly doubled.

## One place for event names

`packages/site-kit/src/goals.ts` is the single source of truth. The identifier is
written there once, all three sites take it from there, and exactly that string is
registered as a goal in Metrika. There should be no `'form_view'` literals in the
apps.

`packages/site-kit/src/funnel.ts` (`defineFunnelTracking`) wires everything up from
the markup and is called once from each app's layout. Contact clicks live
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
| `brand_link_click`                                               | left for a partner site (approved.rs only)      | `brand`: `details`, `carlab`                      |
| `lang_offer_shown` / `lang_offer_taken` / `lang_offer_dismissed` | the language-choice banner                      | `from`, `to`                                      |
| `case_view`                                                      | opened a Case study                             | `depth`: Case studies opened this visit           |

`scroll_50`, `form_view` and `form_start` fire once per page rather than once per
form: the approved.rs homepage has three forms, and counting them separately would
triple the numerator.

**JS events do not deal with anything visible from the URL.** A service-page view
and the thank-you page are registered as URL goals in Metrika directly —
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
| `aria-invalid="true"`    | a field that failed validation | the field name in `form_error`    |

`data-contact-placement` names where on the page the control sits, never which
component renders it: `hero`, `bar`, `floating`, `footer`, `header`, `thanks` —
one word can therefore be stamped by several components (`bar` is every full
contact bar, wherever it is rendered) and `thanks` is a whole page, because that
page is one region. The closed set is `CONTACT_PLACEMENTS`
in `packages/site-kit/src/goals.ts`, stamped through `contactPlacement()` so a
typo is a build error. It goes on a container, and the tracker reads the nearest
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

The counter ids are in [deploy.md](deploy.md), to avoid keeping a third copy. Each
has a composite goal, **"ENQUIRY FUNNEL: saw → started → submitted"**
(`form_view` → `form_start` → `form_submit`). A composite goal only counts if every
step happened within one visit; there can be up to five steps and up to ten
conditions per step.

Registered by hand in all three counters: the four form steps, the two reading
events, `contact_click`, the three language-banner events, a URL goal on
`/thanks/`, and the funnel itself. On approved.rs there are additionally
`lead_modal_open`, `brand_link_click` and the URL goal "Interest — a service page
or a case study".

Metrika's automatic goals (form submission, going to a messenger, clicking a phone
number) are left alone: they count the same things independently of our code and
serve as a cross-check.

## The CarLab shop

`add_to_cart` (with a `type` parameter — the product type's key), `begin_checkout`
and `order_placed` (with a `total` parameter, in RSD) are the shop funnel, and they
are carlab.rs only. The goals are created in the counters when the shop moves to
`live`, not before: while it is in `preview`, those events are only sent by
developers with `?dev=true`, and such visits are excluded from samples the same way
as everything else in `docs/analytics-exclusions.md`.

## How to add an event

1. Add the identifier to `GOALS` and call `reachGoal` where it happens.
2. Cover it with a test: `packages/site-kit` holds a 100% gate and CI will fail
   without one.
3. Register the goal by hand in **all three** counters: Goals → Add goal →
   "Target event", condition **Matches**, identifier exactly the same string.
   Our Metrika API access is read-only, so goals are managed through the interface.

An event registered in code but not in the counter is counted nowhere and lost
silently — it is the most common way to end up with no data.

## What these numbers will not show

Moving between sites breaks the session: going from approved.rs to details.rs means
a different domain and a different counter, where the person is already a new
visitor with approved.rs as the referrer. `brand_link_click` is the only place that
transition is visible from approved.rs's side.

To see which partner the visitor left for, open the approved.rs counter (the
other two never fire this event), take the goal `brand_link_click` and group it
by the visit parameter `brand`: one row for `details`, one for `carlab`. The
language banner keeps `from` / `to`, so grouping by `to` would mix locale codes
into the same report. Apply the standing exclusions from
[analytics-exclusions.md](analytics-exclusions.md) before reading the numbers.

Nothing from a dev server. All three layouts skip `defineAnalytics` when
`import.meta.env.DEV`, so no Metrika script is loaded locally and `reachGoal` is a
no-op — verify an event against a build (`pnpm build`, then
`pnpm --filter <app> preview`), never against `pnpm dev`. A preview serves the
production build and so does report to the real counter, from `127.0.0.1`; the
`only_mirrors` filter is what keeps that out of the reports.

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
