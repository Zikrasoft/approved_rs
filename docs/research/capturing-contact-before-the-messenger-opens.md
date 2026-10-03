# Capturing a contact before the messenger opens

Research date: **2026-10-02**. Question from the owner: contact-click leads are
ghosts — someone taps the Telegram tile or the phone button, a Lead is stored, and
they never write or call. How do we pull a reachable contact out of as many
visitors as possible? His own idea: intercept the tap and flash a small modal
asking for a Telegram handle or a number, then let the messenger open. His own
counter-question: should the direct messenger and phone options be removed
instead — except that then a visitor who wants to call cannot, and a bare number
shown as text creates no Lead at all.

## Source status

Tags used below, same convention as `how-many-ctas-in-a-hero.md`,
`white-vs-dark-theme-lead-drop.md` and `serbia-online-shop-legal.md`:

- **[P]** — primary source read directly in this session: the text of a standard,
  a vendor's own documentation page, a browser engine's own source file, a file or
  commit object in this repository, or a Yandex Metrica report pulled here.
- **[S]** — secondary: a commit message or issue body asserting a measurement
  whose underlying data was not re-pulled here, or a search-engine snippet of a
  page that would not render.
- **[NOT ESTABLISHED]** — could not be verified from any available source.

Every Metrica number in §3 was pulled in this session with the mandatory
exclusions of `docs/guides/analytics-exclusions.md` applied (7 clientIDs from
`.local/analytics-exclusions.txt`, plus the `Russia` region). Raw: 417 visit rows
from the Logs API for counter `111800377`, 2026-08-01 → 2026-10-01; 124 rows
dropped by clientID, 57 as Russia, 43 of those overlapping, **279 kept**. The one
table that could not be filtered that way is flagged in place. No number here was
estimated.

---

## Verdict first

1. **The micro-modal works technically, but only in the shape where the visitor's
   own tap inside the modal is the navigation.** A modal that calls
   `preventDefault()` on the tile, then navigates from its own confirm button's
   click handler, is indistinguishable to every engine from a direct tap:
   `location.assign` is **not** gated by user activation at all, and same-tab
   navigation is not an activation-consuming API. [P] A modal that navigates from
   a timer instead — "flash it for three seconds, then go" — is where it breaks,
   differently in each engine (§4). So the idea is not blocked by the platform;
   it is blocked by one specific implementation of it.

2. **But it is still the wrong first move here, because the thing it would fix is
   mostly already fixed, and the evidence for the fix is in this repo.** The exact
   experiment the owner is describing was run on approved.rs in September 2026 and
   reverted a week later. Commit `d9716d5` (2026-09-24) routed every messenger
   tile through the lead form — a harder version of the micro-modal, since the
   messenger did not open at all — with this in its own message: _"Of 24 such
   leads, 12 were never touched and none became a deal; of 10 form leads, 6
   progressed and one closed."_ [P for the commit, S for the numbers] Eight days
   later the CRO audit priced the detour and `fd14760` (2026-10-02) undid it:
   _"in 6 of 18 visits in the window the visitor went hunting for a direct
   messenger link after a tile labelled «Написать в Telegram» produced a form"_
   (`docs/adr/0015`). [P] A modal is the same detour with a shorter leash. Before
   building a third variant, note that nothing has been measured since the revert
   — it shipped today.

3. **The ghost chore the owner is describing was already retired, two ADRs ago.**
   `docs/adr/0029` and `isGhostLead` in `packages/lead-crm/src/store.ts` expire a
   contact click that never gained a contact: 24 hours, swept by the existing
   reminder cron, archived and marked `lost`. [P] So "I have leads where a person
   taps Telegram and does not write" is now a card that disappears by itself
   rather than a to-do the operator deletes by hand. What is _not_ solved is the
   part worth solving: those visitors are unreachable.

4. **"Remove the direct options" is the one answer the repo has already rejected
   on evidence, twice**, and his own objection is correct: `docs/adr/0015` and the
   `pointer-coarse`/`pointer-fine` rule in `AGENTS.md` exist precisely because a
   label that promises a messenger and produces a form costs every visitor the
   detour while only the share who fill it pay it back. [P]

5. **His premise that a bare number creates no Lead is only half true, and the
   half that is true is already handled.** A `tel:` link carrying
   `data-contact-channel="phone"` does create a Lead on tap —
   `defineContactClickTracking` fires `navigator.sendBeacon` to
   `/api/contact-click` before the dialer opens. [P] What creates no Lead is the
   number rendered as selectable text, which happens in exactly one place
   (`/thanks/`, via `@podbor/site-kit/format-phone`). Everywhere else a desktop
   visitor is given a callback button instead of a number, which is the current
   answer to his objection. [P]

6. **The structurally better capture is not a modal at all: it is pointing the
   Telegram CTA at the bot instead of the manager's human account.** Telegram's
   own docs are unambiguous that a bot receives the person's `id` (always),
   `first_name` (always) and `username` (optional) the moment they press Start,
   with the `?start=<payload>` deep-link parameter arriving as the message text —
   zero form fields, no modal, no interception. [P] The bot already exists in this
   repo and already owns the CRM. The cost is UX honesty (the visitor lands in a
   bot, not with a person) and one visitor branch in a webhook that currently
   drops everyone without an operator role. [P]

7. **Nobody has published a credible number for what an interstitial before a
   chat or phone CTA costs.** The only first-party measurement anywhere near it is
   Google+'s 2015 app-install interstitial study, which is a full-page
   interstitial shown _on arrival_, not a modal after a declared intent, and it
   publishes no sample size. [P] Any percentage offered for this decision is
   fabricated or borrowed from that study. The honest input is this site's own
   data, and this site's own data is thin (§3).

---

## 1. What the repo already does, so nothing gets rebuilt

### The contact click is already a Lead

`packages/site-kit/src/contactClick.ts` — `defineContactClickTracking` is a
run-once page effect called from each app's layout. It walks every
`[data-contact-channel]` element and on click:

- fires the `contact_click` Metrica goal with `channel` and `placement`, the
  latter read from the nearest `[data-contact-placement]` ancestor;
- posts `channel`, `source_url` and `visitor_id` to `/api/contact-click` through
  `navigator.sendBeacon`, which survives the page being replaced by the dialer or
  the messenger.

The tiles themselves stay plain `<a href>` — `telegramLink`, `whatsappLink`,
`viberLink`, `phoneLink` from `@podbor/site-kit/contact-links`. Nothing
intercepts the click today. [P]

### What a contact-click Lead records, and what it cannot

`createContactClickRoute` in `packages/lead-crm/src/routes/contactClick.ts`
builds the submission by hand:

| field                        | value for a contact click                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `kind`                       | `'call_click'`                                                   |
| `contact`                    | `'—'` — the placeholder, always                                  |
| `contactChannel`             | the tapped channel, zod-parsed, `.catch('phone')`                |
| `name`, `service`, `comment` | empty                                                            |
| `services`                   | `[]`                                                             |
| `source_url`                 | the page the tap happened on                                     |
| `visitorId`                  | the localStorage visitor id, or absent if analytics was declined |
| `locale`                     | derived from the first path segment of `source_url`              |
| `brand`                      | stamped server-side by `createNotifyLead({ brand })`             |

It **cannot** record anything about the person: no handle, no number, no name, no
confirmation that the conversation started. It cannot record it because nothing on
the visitor's side knows it. The manager's Telegram account is a human account and
the conversation never touches this infrastructure — `docs/adr/0029` says so
outright. [P]

### What the operator sees

`createFormatter` in `packages/lead-crm/src/telegram/format.ts`: where a form lead
shows its service, a contact click shows `Клик: <канал>` through `clickLabel`, the
contact line reads `— (Telegram)`, and the visited page goes on the `Страница:`
line. The `Клик:` line exists only while `kind === 'call_click'` **and** the
contact is still the placeholder — the moment a real contact arrives it becomes an
ordinary lead. [P]

### The 60-minute merge window is the quiet half of the design

`insertOrMergeLead` in `packages/lead-crm/src/store.ts`: a new submission carrying
the same `visitorId`, the same `brand`, status still `new` and not archived, within
`VISITOR_MERGE_WINDOW_MS` = 60 minutes, **merges into the existing Lead** rather
than creating a second one. If the existing contact is the placeholder and the new
one is real, the Lead is upgraded in place — name, contact, channel, service — and
the comment gains `Сначала кликнул: Telegram` / `Также пробовал: …`. [P]

This matters for every option below: **a capture that happens after the tap does
not create a duplicate card.** It upgrades the card the tap already made, and the
operator sees one Lead whose comment records that the visitor tried Telegram
first. The visitor id lives in `localStorage` (`packages/site-kit/src/visitorId.ts`)
and survives the trip to the messenger and back, unless the visitor declined
analytics, in which case there is no id and no merge. [P]

### Ghosts already retire themselves

`isGhostLead`, `GHOST_LEAD_RETENTION_MS` = 24 h, `expireGhostLeads(now)` called
once a day from `api/reminders.ts` alongside the postponed sweep, setting both
`archived` and `lost` and refreshing each card. All four conditions are required:
`kind === 'call_click'`, contact still the placeholder, status still `new`, not
archived. A click the operator advanced, or one the merge window upgraded, is
never swept. [P]

So the operator's chore is gone. The business problem that remains is narrower than
the owner's phrasing: **not "false to-dos", but "unreachable visitors"**.

### The desktop phone shape

`AGENTS.md` and `ContactCTA.astro`: a `tel:` control exists only where a dialer
does, chosen by `pointer-coarse:hidden!` / `pointer-fine:hidden!`. Where a
callback sibling is already on screen the phone control is simply absent on a
fine pointer; where the phone link would be the only phone control, a callback
button takes its place carrying `callbackButtonLabel`, and that button opens the
lead modal with `channel: 'phone'` (`callbackTrigger()` →
`leadModalTrigger('phone')`). `/thanks/` is the single carve-out where the number
is rendered as plain text. [P]

That is the existing answer to "I cannot just leave a number". It is not a gap;
it is a decision. The gap is that a desktop visitor who wants to dial right now,
from their own phone, sees no number anywhere except `/thanks/`.

### The form already accepts a handle

`isValidContact` in `packages/lead-crm/src/phone.ts`: with
`channel === 'telegram'` and input that does not look like a phone number, the
contact is validated against `TELEGRAM_HANDLE` (`/^@?[a-zA-Z]\w{2,31}$/`) and
normalised to `@handle` by `telegramContact`. Only the contact is required; `name`
accepts empty. [P]

So the micro-modal the owner imagines would not need a new field type, a new
schema or a new route. One `contact` input and a hidden `contact_channel` posted
to the existing `/api/leads` is the whole server side.

---

## 2. The one direct measurement of the ghost problem in this repo

Commit `d9716d5` (2026-09-24), message verbatim:

> A `contact_click` lead carries no way to reach anyone: the contact field holds
> "—" and the comment is boilerplate. Of 24 such leads, 12 were never touched and
> none became a deal; of 10 form leads, 6 progressed and one closed.

[P] for the commit object; **[S]** for the numbers — the lead store was not
re-read in this session, and it cannot be: `data/leads.json` lives on Vercel Blob,
and the two `*/.local-data/data/leads.json` files in the working tree hold two
rows each, which is dev scratch. **The ghost rate is unmeasured as of today.** §7
names the query that would measure it.

Read carefully, those numbers say two different things, and only one of them
supports a capture modal:

- **24 contact clicks, 0 deals, 12 untouched.** A contact click, as a Lead, is
  worth approximately nothing to the operator. That is the case for capture.
- **10 form leads, 6 progressed, 1 closed.** A form lead is worth a great deal.
  That is the case for _more form leads_, which is not the same thing as _fewer
  direct taps_.

The intervention that followed — route the taps into the form — raised neither
number, and the audit eight days later found it was costing visits. The asymmetry
in those two rows is real; the conclusion that a detour captures it is the part
that failed.

---

## 3. What the data says, with the exclusions applied

### approved.rs is the only counter with anything in it

| counter                 | window                              | visits  | contact clicks             | form submits |
| ----------------------- | ----------------------------------- | ------- | -------------------------- | ------------ |
| `111800377` approved.rs | 2026-08-01 → 10-01, filtered        | **279** | **38 reaches / 21 visits** | see below    |
| `112647692` carlab.rs   | 2026-09-01 → 10-02, Russia excluded | 69      | **0**                      | **0**        |
| `112647721` details.rs  | 2026-09-01 → 10-02, Russia excluded | 50      | **0**                      | **0**        |

[P] carlab.rs and details.rs have no history at all: 77 and 58 unfiltered visits
each since they started reporting in September, zero `contact_click`, zero
`form_submit`, zero `/thanks/`. The only non-zero goal across both is Metrica's
own automatic "went to a messenger" goal on carlab.rs, twice. **Any decision taken
from brand-site data is taken from nothing.** Everything below is approved.rs.

### The filtered approved.rs sample

279 visits — 234 phone, 43 desktop, 2 tablet. Phone is 84% of the sample, which is
the first thing any of these options has to survive. [P]

| goal                                              | reaches | converted visits | by device (visits)              |
| ------------------------------------------------- | ------- | ---------------- | ------------------------------- |
| `contact_click` (599977093)                       | 38      | 21               | 16 phone / 4 desktop / 1 tablet |
| `/thanks/` URL goal (600279525)                   | 19      | 14               | 9 phone / 5 desktop             |
| `lead_modal_open` (599976705)                     | 21      | 18               | 14 phone / 3 desktop / 1 tablet |
| Metrica auto "went to a messenger" (602202574)    | 18      | 12               | 10 phone / 1 desktop / 1 tablet |
| Metrica auto "clicked a phone number" (611508206) | 9       | 7                | 6 phone / 1 desktop             |

**The ratio the owner is asking about: 38 contact clicks against 19 lead-form
conversions — contact clicks are twice the form leads.** Or by visit: 21 visits
produced a contact click, 14 reached `/thanks/`; 7.5% and 5.0% of 279. [P]

`form_view` / `form_start` / `form_submit` (goals `662043486`, `662043584`,
`662043651`) read 76/3/3 reaches, but those goals were only created in the second
half of September — August and the first three weeks of September are zero by
definition, and `form_submit` was additionally redefined on 2026-10-02 (issue #54,
`docs/guides/analytics.md`). **The `/thanks/` URL goal is the only form-side series
with history over this window**, which is why it is the one used above. [P]

### The closest thing to a ghost rate that analytics can give

From the same filtered rows, matching goals within a visit and across a clientID:

- Of the **21 visits** that produced a contact click, **4** also reached
  `/thanks/`.
- Of the **20 unique clientIDs** that produced a contact click, **5** ever
  reached `/thanks/` in any visit in the window. [P]

So **15 of 20 visitors who tapped a contact control never left a contact on the
site.** That is not the ghost rate: some of those 15 wrote in Telegram, which
Metrica cannot see and only the operator can. It is an upper bound on the share
whose contact we failed to capture _on the site_, and it is the number a capture
mechanism would be trying to move.

### The channel split, and why it is weaker than the rest

Metrica's Reporting API has no `clientID` dimension or filter, so this one table
is **Russia-excluded but clientID-unfiltered** — the only number here that does
not carry the full exclusion. The 7 clientIDs contributed 2 of the 40
Russia-excluded `contact_click` reaches, so the distortion is small, but it is not
zero. Values are visits carrying that `channel` goal parameter, not reaches, over
2026-08-01 → 2026-10-02. One visit can appear in more than one row, so the rows
sum to more than the total. [P]

| `channel`                 | phone | desktop | tablet |
| ------------------------- | ----- | ------- | ------ |
| `telegram`                | 11    | 4       | —      |
| `phone`                   | 7     | 1       | —      |
| `whatsapp`                | 3     | —       | 1      |
| `viber`                   | 1     | 1       | —      |
| `callback`                | 1     | —       | —      |
| **total distinct visits** |       |         | **22** |

Telegram is the channel, by a factor of two over the phone. WhatsApp trails it
three to one despite `applyPreferredContactOrder` promoting WhatsApp first for
every Serbian, German and Spanish timezone (`packages/site-kit/src/contactPreference.ts`).
`callback` is a control that merely opened the form; the 2026-10-02 change stopped
stamping it. [P]

### The caveat that undercuts all of §3

The sample straddles the experiment described in §2.

| era                                         | visits | contact clicks         | `/thanks/` |
| ------------------------------------------- | ------ | ---------------------- | ---------- |
| 2026-08-01 → 09-23, tiles were direct links | 198    | 34 reaches / 17 visits | 16 / 12    |
| 2026-09-24 → 10-01, tiles opened the form   | 81     | 4 reaches / 4 visits   | 3 / 2      |

[P] Commit dates, not deploy dates — `git log` puts `d9716d5` at 2026-09-24 and
the revert `fd14760` at 2026-10-02, and the deploy lag is not accounted for here.
The first row is the era whose shape matches the site as it stands today, and it is
the row the §3 conclusions should be read from: **198 visits, 17 of which produced
a contact click, 12 of which reached `/thanks/`.** The second row is eight days of
the detour, and four contact clicks is not a measurement of anything.

Put plainly: **the current shape of approved.rs has been live for one day and has
no data.** The honest position is to let it run before changing it again, which is
also the cheapest position.

---

## 4. The technical verdict on a gesture-eating interstitial

This is the make-or-break question and the answer is better than expected, with
one sharp edge.

### Navigation is not activation-gated. The popup is.

The HTML Standard's Location-object navigate algorithm mentions transient
activation exactly once, and not as a gate:

> If location's relevant Document is not yet completely loaded, and the incumbent
> global object does not have transient activation, then set historyHandling to
> "replace".

— <https://html.spec.whatwg.org/multipage/nav-history-apis.html#location-object-navigate> [P]

Activation decides push-vs-replace in the session history, before load completes.
Nothing more. **Same-tab top-level navigation via `location.assign` or
`location.href` is allowed at any time, with or without activation, and does not
consume activation.** MDN's own list of features gated by user activation contains
`Window.open()` and thirty-odd device and picker APIs, and contains neither
`location.assign`, `location.href`, nor `HTMLElement.click()`:
<https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation> [P]

`window.open` is a different matter, and this is literally where the popup blocker
lives — in the rules for choosing a navigable, not in `window.open` itself:

> If currentNavigable's active window does not have transient activation and the
> user agent has been configured to not show popups (i.e., the user agent has a
> "popup blocker" enabled) — The user agent may inform the user that a popup has
> been blocked.

— <https://html.spec.whatwg.org/multipage/document-sequences.html#the-rules-for-choosing-a-navigable> [P]

and the branch that does open one begins "Consume user activation". MDN's
`Window.open` page states the window outright: _"This call must be made with
transient activation (i.e., inside a user interaction event handle such as
`click`), within five seconds of user interaction."_ [P]

**Practical rule: never reopen the messenger with `window.open`. Use
`location.assign`, or let a real `<a href>` do it.**

### What the spec says the duration is: no number

> A user agent also defines a transient activation duration, which is a constant
> number indicating how long a user activation is available for certain user
> activation-gated APIs (e.g., for opening popups).
>
> The transient activation duration is expected be at most a few seconds, so that
> the user can possibly perceive the link between an interaction with the page and
> the page calling the activation-gated API.

— <https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation> [P]

There is no recommended value in the spec. "At most a few seconds", user-agent
defined. The 5 seconds everyone quotes is an implementation constant, not spec
text. The same section defines:

- **sticky activation** — _"the current high resolution time given W is greater
  than or equal to the last activation timestamp in W"_; the historical bit,
  true forever after the first interaction;
- **transient activation** — the same, _"and less than the last activation
  timestamp in W plus the transient activation duration"_; the recent bit;
- **activation triggering input event** — _"any event whose `isTrusted`
  attribute is true"_ and whose type is `keydown` (not Esc or a UA shortcut),
  `mousedown`, `pointerdown` with `pointerType` `mouse`, `pointerup` with any
  other `pointerType`, or `touchend`;
- **consume user activation** — sets the last activation timestamp to negative
  infinity _"for each window in windows"_, deliberately across the whole
  hierarchy, _"to prevent malicious sites from making multiple calls to an
  activation consuming API from a single user activation"_. [P]

### The one place activation does bite a `tel:` navigation

`tel:` is a non-fetch scheme, so it leaves the ordinary navigation path. Two
clauses matter. First, the page is not destroyed:

> If url is to be handled using a mechanism that does not affect navigable, e.g.,
> because url's scheme is handled externally: Hand-off to external software …

Second, and this is the sentence that decides the question at spec level:

> Perform the appropriate handoff of resource while attempting to mitigate the
> risk that this is an attempt to exploit the target software. For example, user
> agents could prompt the user to confirm that initiatorOrigin is to be allowed to
> invoke the external software in question. **In particular, if
> hasTransientActivation is false, then the user agent should not invoke the
> external software package without prior user confirmation.**

— <https://html.spec.whatwg.org/multipage/browsing-the-web.html#non-fetch-schemes-and-external-software> [P]

So an un-activated `tel:` navigation is a _should-confirm_, not a block. And the
`has transient activation` bit is read from the source snapshot params, snapshotted
at the start of the navigation, not at hand-off time. [P]

The first clause has a second consequence worth keeping: because the hand-off
_"does not affect navigable"_, the page survives a `tel:` tap intact — same
document, same JS heap, no reload, nothing to restore. Whatever the modal put in
memory is still there when the visitor comes back. [P]

### Per-engine, for the timer case

Engine source, read directly:

- **Chromium: `kActivationLifespan = base::Seconds(5)`** in
  `third_party/blink/public/common/frame/user_activation_state.h`, with the
  comment _"The expiry time should be long enough to allow network round trips
  even in a very slow connection … yet not too long to make an 'unattended' page
  feel activated."_ Every renderer-initiated navigation is stamped
  `request.SetHasUserGesture(frame_->HasTransientUserActivation())` in
  `content/renderer/render_frame_impl.cc` — so in Chromium the gesture is
  **time-based, not call-stack-based**, and a 3-second `setTimeout` still carries
  it. Chrome's own blog at <https://developer.chrome.com/blog/user-activation>
  says "about a second"; it is stale, the source constant is authoritative. [P]
- **Chrome desktop's external-protocol gate is not a clock at all.** It is a
  global anti-flood one-shot, `g_accept_requests` in
  `chrome/browser/external_protocol/external_protocol_handler.cc`, set false on
  each external launch and set true again by any non-scroll input event
  (`ExternalProtocolObserver::DidGetUserInteraction`). Hence the console string
  _"Not allowed to launch '…' because a user gesture is required."_ A delayed
  `tel:` of any delay works on Chrome desktop as long as some interaction
  happened and no other external launch ate the flag. An extension's API calls
  also reset it, so it is not deterministic per profile. [P]
- **Chrome Android returns `REQUIRES_PROMPT`** for a renderer-initiated
  navigation without a gesture —
  `components/external_intents/.../ExternalNavigationHandler.java`,
  _"Ensure the navigation was started with a user gesture so that inactive pages
  can't launch apps unexpectedly"_. Past 5 seconds the visitor gets a
  confirmation sheet rather than the dialer. [P]
- **WebKit's transient activation duration is also 5 s**
  (`defaultTransientActivationDuration { 5_s }` in
  `Source/WebCore/page/LocalDOMWindow.cpp`) — **but the external-scheme decision
  does not use it.** `shouldOpenExternalURLsPolicyToApply` in
  `Source/WebCore/loader/FrameLoader.cpp` branches on
  `UserGestureIndicator::processingUserGesture()`, which is a current-token
  question, and gesture forwarding into timers is capped at
  `maximumIntervalForUserGestureForwarding { 1_s }` in
  `Source/WebCore/dom/UserGestureIndicator.h` (_"One second matches Gecko"_).
  **In WebKit a `setTimeout` of ≥ 1 s loses the gesture for external-URL policy
  purposes.** It falls through to the document loader's propagated policy, which
  for a main frame the visitor reached by clicking a link is still `ShouldAllow`
  — so it may well work, by a different route. Note the asymmetry in
  `APINavigationAction.h`: a bare external scheme survives on
  `ShouldAllowExternalSchemesButNotAppLinks`, while **app links need
  `ShouldAllow`**, i.e. a real gesture. [P]
- **iOS always confirms a `tel:` from the web anyway.** Apple: _"iOS displays an
  alert asking if the user really wants to dial the phone number and initiates
  dialing if the user accepts."_
  <https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html>
  — archived, and silent on script-initiated vs tap-initiated. [P] for the quote,
  [NOT ESTABLISHED] for the delayed case.

### The sharp edge: `t.me` is not `tel:`

`https://t.me/handle` is an ordinary https navigation. It is never popup-blocked
and never activation-gated. But opening it in the **Telegram app** rather than
Telegram's website depends on iOS Universal Links / Android App Links, and Apple's
documentation only ever describes the tap case — _"When a user taps a universal
link, iOS launches your app…"_
(<https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html>).
[P] Apple publishes **no** statement that a script-initiated or delayed navigation
fails to trigger a universal link; developer-forum threads report that it does
fail, including a sub-500 ms figure, but a forum post is not owning documentation
and that figure is **[NOT ESTABLISHED]**.

The risk is concrete and it is the worst failure mode of the whole idea: a modal
that works perfectly in testing and quietly lands every iPhone visitor on
`t.me`'s web page instead of their Telegram app, where the prefilled message is
gone and they have to log in.

### And the gestures the interception never sees

- **Middle-click and right-click never fire `click`.** Pointer Events Level 4:
  _"Secondary buttons (like the middle or right button on a standard mouse) MUST
  NOT fire `click` events."_ They fire `auxclick`, whose default action is the
  link's activation behaviour. <https://w3c.github.io/pointerevents/> [P] A
  middle-click on the tile bypasses the modal and opens the real link — arguably
  the better outcome.
- **Cmd/Ctrl-click and Shift-click do fire `click`**, so a naive
  `preventDefault()` swallows the visitor's own "open in a new tab" and shows
  them a modal instead. Any interception must let through
  `event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0`. [P]
- **iOS long-press** opens the context menu, and when the visitor picks "Open in
  New Tab" the UI process navigates from the element's `href` without dispatching
  a DOM `click`. Apple's only statement is from the archived pre-iOS-13 guide
  (_"Displaying the information bubble doesn't generate any events"_), so the
  modern behaviour is **[NOT ESTABLISHED]**. [P] for the archived quote.
- Consequently: **the `href` must stay a real, correct `tel:`/`t.me` URL.** Never
  `#`, never a `javascript:` stub. Everything that reads the attribute directly —
  long-press, middle-click, copy link, a crawler, a visitor with JS off — uses it.
  That is also the no-JS fallback `d9716d5` already kept. [P]

### Verdict

The buildable shape of the owner's idea is:

1. the tile keeps its real `href`;
2. the click handler returns early on modifier keys and non-primary buttons;
3. `preventDefault()`, open the modal, show one field;
4. the modal has **two** controls, both real `<a href="…">` to the messenger: a
   primary "send my handle and open Telegram" and a secondary "just open
   Telegram";
5. the confirm control posts the contact with `fetch`/`sendBeacon` and lets its
   own `href` navigate — no `preventDefault` on it, no timer, no `window.open`.

In that shape the visitor's tap inside the modal _is_ the navigation, so there is
no activation question, no universal-link question and no engine difference. Every
step that deviates from it — a timer, a `window.open`, a programmatic navigation
after an `await` — reintroduces one of the failure modes above.

---

## 5. What the platforms actually hand you

### Nothing happens until the person sends a message

On all three platforms a prefilled-text link is a **client-side draft** and the
business learns nothing until the visitor presses send. Telegram's MTProto link
spec describes `text` as _"UTF-8 text to pre-enter into the text input bar"_
(<https://core.telegram.org/api/links>). [P] WhatsApp's Cloud API webhook field
list — `messages`, `message_template_status_update`, `account_update`, and
sixteen others — contains **no** link-click, chat-opened or user-viewed event at
all; the earliest trigger is `messages`
(<https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks>). [P]
Viber's deep-link `text` parameter: _"The user will be able to send the text as it
is, edit it, or delete it"_ (<https://developers.viber.com/docs/tools/deep-links/>). [P]

**So attribution for a messenger tap has to come from our own analytics, which is
exactly what `defineContactClickTracking` already does.** There is no platform
signal to go and fetch. [P]

### Telegram `?start=` vs `?text=` — the AGENTS.md claim is correct

`AGENTS.md` says `start` is bot-only and `text` is the documented parameter for
public username links. Verified, and it is precisely right.

`core.telegram.org/api/links` has a **"Public username links"** section
documenting `t.me/<username>?text=<draft_text>&profile`, with `draft_text` marked
Optional; `text` is also documented for phone-number links and share links. It is
**not** listed under "Bot links". The **"Bot links"** section documents
`t.me/<bot_username>?start=<parameter>` and lists only `parameter`; `start` is
**not** listed under public username links. [P]

`core.telegram.org/bots/features#deep-linking` gives the bot side verbatim:

> A-Z, a-z, 0-9, `_` and `-` are allowed. We recommend using base64url to encode
> parameters with binary and other types of content. The parameter can be up to
> 64 characters long.
>
> In private chats, you can use the start parameter to automatically pass any
> value to your bot whenever a user presses the link. For example, you could use:
> `https://t.me/your_bot?start=airplane`. When someone opens a chat with your bot
> via this link, you will receive: `/start airplane`

[P] So the payload arrives as the message text. `?start=` on a human username is
inert — the spec conditions the Start button on _"if provided and the
bot_username is indeed a bot"_. `?text=` on a bot link is undocumented and
**[NOT ESTABLISHED]**. [P]

### What a bot gets on the first `/start`

`core.telegram.org/bots/api`, the `User` object, with the doc's own Optional
markers: **`id` required** (_"Unique identifier for this user or bot"_),
**`is_bot` required**, **`first_name` required**, `last_name` **Optional**,
`username` **Optional**, `language_code` **Optional**, `is_premium` Optional. **No
phone number anywhere.** [P]

The only official route to a phone number is `KeyboardButton.request_contact` —
_"If True, the user's phone number will be sent as a contact when the button is
pressed. Available in private chats only."_ — which yields a `Contact` with
`phone_number` and `first_name` required. One tap by the visitor. [P]

And the restriction that makes this a capture rather than a lead-magnet:
_"Bots can't start conversations with users. A user must either add them to a
group or send them a message first."_ (<https://core.telegram.org/bots>) [P] The
bot can reply, forever, to anyone who pressed Start. It cannot cold-message.

### Nobody learns who merely opened a `t.me` link to a human

Three independent reasons from the docs: a human account is not an API endpoint
and opening the link only resolves a username; the Bot API has no "chat opened"
update, and the one that looks like it is scoped away — _"For private chats, this
update is received only when the bot is blocked or unblocked by the user"_
(`my_chat_member`); and `?text=` never leaves the device until the visitor sends
it. [P]

The sole exception is **Telegram Business chat links** (`t.me/m/<slug>`), which
carry an aggregate `views:int` counter — _"the number of times a business chat
link was resolved (clicked on, scanned) by a user"_
(<https://core.telegram.org/api/business>). A number, no identity, and it requires
a Business/Premium subscription on the manager's account. [P] It would duplicate
what `contact_click` already counts, with less detail.

### Telegram Login is now OIDC, and the old docs are archived

Worth knowing before anyone plans around the old widget:
<https://core.telegram.org/widgets/login> now documents a _"Telegram Login library
and the new OpenID Connect login flow"_; the iframe widget is archived at
`/widgets/login-legacy`. [P] Scopes map to claims: `profile` → `id`, `name`,
`preferred_username`, `picture`; **`phone` → `phone_number`** (plus
`phone_number_verified` in the docs' decoded-token example);
`telegram:bot_access` → _"Allows your bot to send direct messages to the user
after login."_ [P]

Setup is @BotFather-registered Allowed URLs, not `/setdomain`, and
_"Telegram will only process logins or redirect users using your pre-registered
URLs."_ Verification is explicitly server-side — _"Important: Verify the validity
of ID token server-side"_ — and the code exchange needs the client secret. [P]
One more trap for a static site: _"If your website serves the
`Cross-Origin-Opener-Policy: same-origin` HTTP header, this cross-window
communication will be blocked and the login process will fail."_ [P]

So Telegram Login is the only mechanism that yields a **verified phone number**
with no typing. It also needs an SSR route, a client secret, a consent screen, and
it asks a visitor for an OAuth login before they have been sold anything.

### WhatsApp, once they write, gives you the phone number

The published "received message" webhook payload carries
`contacts[].wa_id` (the WhatsApp user's phone-number identifier),
`contacts[].profile.name` (their self-set display name) and `messages[].from`
(<https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples>). [P]
That is strictly more than Telegram gives a bot — WhatsApp's identifier _is_ the
number. The mirror restriction applies: _"When a WhatsApp user messages you or
calls you, a 24-hour timer called a customer service window starts"_, and outside
it only approved templates. [P] A `ctwa_clid` click id exists but only for
Click-to-WhatsApp **ads**, and it arrives with the message, not before. [P]

Switching the WhatsApp tile to a Cloud API number means a WhatsApp Business
account, a webhook, and the manager answering through an API inbox instead of
WhatsApp — far more than this question is worth.

### Viber is the only platform with a signal on open, and it is closed

`conversation_started` _"fires when a user opens a conversation with the bot using
the 'message' button … or using a deep link"_ and carries `user.id`, `user.name`,
`user.avatar`, `user.country`, `user.language`, `subscribed`, plus whatever
`context` the deep link passed. [P] Exactly the pre-message identity the owner
wants. But: _"since 5.02.24, Viber bots can only be created on commercial terms.
You can apply to create chatbots on Rakuten Viber by reaching out directly to us
or through our verified official partners."_
(<https://developers.viber.com/docs/api/rest-bot-api/>) [P] Not reachable without
a partner deal, for the channel with 2 of 22 visits in §3.

**Repo note, worth a line in `contactLinks.ts` one day:** Viber's own deep-link
page documents only `viber://pa?chatURI=`, `viber://pa/info?uri=` and
`viber://pa/qr?chatURI=` — all bot links. The `viber://chat?number=` form this
repo uses appears nowhere in Viber's documentation. It works in the wild;
it is **[NOT ESTABLISHED]** as a supported URL. [P] for the absence.

---

## 6. What the evidence on extra steps actually supports

### The only first-party interstitial measurement, and why it does not apply

Google+, on its own property, published by the engineer who ran it
(<https://developers.google.com/search/blog/2015/07/google-case-study-on-app-download-interstitials>):

> 9% of the visits to our interstitial page resulted in the "Get App" button being
> pressed. … 69% of the visits abandoned our page. These users neither went to the
> app store nor continued to our mobile website.

and after removing it:

> 1-day active users on our mobile website increased by 17%. … G+ iOS native app
> installs were mostly unaffected (-2%).

[P] **No sample size, no duration, no confidence intervals** — the post states
none. And three structural mismatches with the question here: it was a full-page
interstitial, not a modal; it fired **on arrival**, before the visitor had
expressed any intent, where the proposed modal fires on someone who has already
committed; and its denominator is page visits, not CTA taps. **The 69% is the cost
of blocking content someone came for. It is not the cost of interrupting a
declared intent, and it must not be reused as one.**

Google's current policy page carries no numbers and, importantly, does not target
this case — the 2017 ranking signal is scoped to _"the transition from the mobile
search results"_ and exempts _"Banners that use a reasonable amount of screen
space and are easily dismissible"_
(<https://developers.google.com/search/blog/2016/08/helping-users-easily-access-content-on>,
<https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials>). [P]
A modal the visitor opened by their own tap is not an intrusive interstitial in
Google's sense.

### Baymard measures something else, and says so

Their transferable finding argues _against_ the step framing:

> the number of form fields in a checkout impacts overall usability far more than
> the number of steps

— <https://baymard.com/blog/checkout-flow-average-form-fields> [P]

Their abandonment study (#GC050, March 2026) reports _"17% – Too long/complicated
checkout process"_ and _"18% – Site wanted account creation"_ among reasons
<https://baymard.com/lists/cart-abandonment-rate>. [P] Two cautions carried over
from the research agent: the respondent count for #GC050 could not be confirmed
from Baymard's own pages (the documented N, 4,384, belongs to their **2022**
round, and must not be attached to the 2026 figures) — **[NOT ESTABLISHED]**; and
the widely-quoted "Baymard says 70% abandon" is their own meta-average _"based on
50 different studies"_, not their measurement. [P]

Either way: Baymard measures multi-field address and payment forms with sunk cost
already invested. **It publishes nothing about a one-field modal in front of a
chat CTA.** The usable principle is only this: if a capture form must exist, its
cost is driven by how many fields it asks, and one field is the floor. The
existing lead form already asks exactly one required field (`docs/adr/0015`).

### NN/g is on-point and has no numbers

> This increase in interaction cost is likely to put off users, unless the dialog
> is well justified and indeed contains important information.

— <https://www.nngroup.com/articles/modal-nonmodal-dialog/> (Fessenden, 2017) [P]

The most relevant NN/g study for a phone-sized modal is
<https://www.nngroup.com/articles/accidental-overlay-dismissal/> (2022, **8
participants**, qualitative): _"Because designers vary in which of these
overlay-dismissal methods they'll allow, users sometimes will pick the wrong
method, with unexpected and costly consequences."_ [P] On a phone — 84% of this
sample — an accidental dismissal of the capture modal is a visitor who tapped
"Write in Telegram" and got nothing at all. That is the failure mode to design
against, and it is the reason the modal needs the explicit "just open Telegram"
escape in §4's shape.

**Nobody should cite NN/g for a percentage. They never published one.**

### The experiment that would answer it does not exist in public

No credible first-party A/B writeup was found for an interstitial or micro-form in
front of a phone or chat CTA. Everything that surfaced was agency or vendor
marketing with unsourced numbers, and none of it is repeated here.
**[NOT ESTABLISHED]**, and the parent should treat any percentage offered for this
decision as fabricated.

---

## 7. The options, ranked

Ranked by expected contact captured per unit of visitor friction and build cost,
for this site, at this traffic volume.

### 1. Let the current shape run and measure the ghost rate from the lead store

- **Captures:** nothing new.
- **Costs the visitor:** nothing.
- **Costs to build:** nothing. The data is already being written.
- **Why first:** the direct-tile shape shipped on 2026-10-02 and has one day of
  data. §3's useful rows are from the era before the detour, and §2's 24-vs-10
  comparison is a week old and from a different page design. Changing the tiles a
  third time inside a fortnight guarantees that no series means anything. The
  query that would settle it is named in §8.
- **Source:** `docs/adr/0029`, `docs/guides/analytics.md`'s "Breaks in the series"
  table, which already records three redefinitions on 2026-10-02 alone. [P]

### 2. Point the Telegram CTA at the bot, with `?start=<payload>`

- **Captures:** the visitor's Telegram `id` (always) and `username` (optional),
  plus whatever page, service and visitor id the 64-character payload carries, the
  moment they press Start. No form, no modal, no typing. And a permanent channel:
  the bot may reply to them forever after.
  <https://core.telegram.org/bots/features#deep-linking>,
  <https://core.telegram.org/bots/api> [P]
- **Costs the visitor:** honesty. The tile says «Написать в Telegram» and they
  land in a bot. The mitigation is to say so on the tile and have the bot's first
  message hand off to a human within seconds; the cost is still real, and
  `docs/adr/0015` is exactly the precedent for what happens when a label promises
  one thing and delivers another.
- **Costs to build:** the bot, the webhook and the chat all exist. Three pieces
  are missing: a visitor branch in `api/telegram-webhook.ts`, which today drops
  every sender whose `roleOf()` is undefined; a `?start=` payload builder and a
  Lead upgrade path keyed on the visitor id it carries; and operator copy. Not
  small, but it is the only option that captures an identity with zero visitor
  effort.
- **Caveat:** `username` is **Optional** in the `User` object and a Telegram
  account need not have one, so the capture is sometimes an opaque `id` the
  operator cannot type into a search box — though the bot can message them, which
  is what matters. No phone number, ever, without a `request_contact` tap. [P]

### 3. The micro-modal, in the shape §4 specifies

- **Captures:** a handle or a number, from the share who fill it, before the
  messenger opens. `isValidContact` already accepts both for
  `channel: 'telegram'`; `insertOrMergeLead` already upgrades the click's Lead in
  place rather than making a second card. [P]
- **Costs the visitor:** one interposed decision on the single clearest intent
  signal on the page. The 2026-09-24 experiment is the closest thing to a
  measurement of that cost on this site, and it went the wrong way (§2). On a
  phone, add NN/g's accidental-dismissal risk (§6).
- **Costs to build:** moderate, and all of it is reuse —
  `defineModalDialog`, `submitLeadForm`, the `contact`/`contact_channel` fields and
  `/api/leads` all exist. The genuinely new code is the interception, which must
  get right: modifier keys and non-primary buttons let through; the real `href`
  preserved; both modal controls real `<a>` elements; no timer, no `window.open`,
  no programmatic navigation after an `await`.
- **The one hard unknown:** whether a navigation to `https://t.me/…` initiated
  from inside the modal still opens the **app** rather than Telegram's web page on
  iOS. If the confirm control is a real `<a href>` tapped by the visitor it should
  be indistinguishable from a direct tap, but Apple documents only the tap case
  and this is **[NOT ESTABLISHED]**. It needs a device test before shipping, not
  a staging test in a resized window.

### 4. Post-click capture: let the messenger open, ask on return

- **Captures:** the same handle or number, from a visitor who has already got
  what they tapped for, so the capture costs them nothing they wanted.
- **Costs the visitor:** nothing on the way out. One prompt on return, which can
  be dismissed into a page they are already done with.
- **Costs to build:** small, and the merge window makes it correct for free —
  the `visitorId` in `localStorage` survives the round trip, so a contact posted
  within 60 minutes upgrades the click's own Lead and the operator sees
  `Сначала кликнул: Telegram` on one card. [P]
- **The event to hang it on is `visibilitychange`, and only that.** MDN: the event
  fires _"on mobile, switches to a different app"_, and _"Transitioning to
  `hidden` is the last event that's reliably observable by the page"_
  (<https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event>). [P]
  Not `unload` (_"Developers should avoid using this event"_; Chrome has stopped
  firing it by default), not `beforeunload`, not `pagehide` (MDN: _"not reliably
  fired by browsers, especially on mobile"_), and not `blur`, which MDN defines
  only as focus loss and says nothing at all about mobile app switching — that
  one is **[NOT ESTABLISHED]** and must not be the trigger. [P] Add `pageshow`
  with `event.persisted` as the companion for the case where the page really was
  navigated away and restored from bfcache. [P]
- **Two guards it needs:** `hidden` also fires on an OS screen lock
  (MDN: _"the OS screen lock is active"_), so a bare `hidden`→`visible` prompt
  fires at people who merely pocketed their phone — gate it on a flag set at tap
  time on the specific tile, plus a minimum away duration. And whether a `tel:`
  hand-off produces `hidden` at all on iOS, where a confirmation sheet appears
  over a page that stays visible, is documented by nobody:
  **[NOT ESTABLISHED]**, device test required.
- **Why it ranks below the bot:** it still asks the visitor to type, and it asks
  at the moment they are least engaged. But it is the only option that costs the
  tap nothing, which is the whole lesson of `docs/adr/0015`.

### 5. Show the number on desktop, as text, next to the callback button

- **Captures:** nothing — and that is the honest trade. It fixes a different
  defect: a desktop visitor who wants to dial from their own phone currently sees
  no number anywhere but `/thanks/` (§1).
- **Costs the visitor:** nothing. It costs the _business_ the Lead record, which
  is the owner's stated objection — correctly stated.
- **Costs to build:** trivial. `formatPhone` from `@podbor/site-kit/format-phone`
  is already imported in `ContactCTA.astro` for exactly this, behind the
  `onThanks` branch. [P]
- **Judgement:** worth doing _alongside_ the callback button rather than instead
  of it. Desktop is 43 of 279 visits in §3 and 4 of 21 contact-click visits, so
  the upside is small either way — but a visitor who copies the number and calls
  is a conversion the current design renders invisible _and_ impossible.

### 6. Make the contact-click Lead more useful to the operator

- **Mostly already done.** `docs/adr/0029` retires the ghost on a timer, the card
  shows `Клик: <канал>` and the visited page, and the merge window upgrades it if
  a contact arrives within the hour. [P]
- **What is genuinely still open**, named by ADR 0029 itself: deduplicating
  contact clicks per visitor and channel, so a visitor who taps three tiles makes
  one card instead of three. ADR 0029 calls it _"still open, and much less urgent
  now"_. [P]
- **What would change the economics** and is not in any ADR: the operator is the
  only party who knows whether the person wrote, and the bot currently never asks.
  A single «Написал / Не написал» pair on a `call_click` card would turn the
  ghost rate from an unmeasured quantity into a weekly number, at the cost of one
  callback pattern in `handleCallbackQuery` and one field. **That, not a modal, is
  what makes the next decision on this question evidence-based.**

### Rejected outright

- **`window.open` to reopen the messenger.** Activation-gated and
  activation-consuming; MDN states the five-second window explicitly. [P]
- **A timer-driven navigation.** Loses the gesture at 1 s in WebKit, 5 s in
  Chromium, and earns a confirmation prompt on Chrome Android. [P]
- **Removing the direct messenger or phone options.** Rejected on this site's own
  evidence twice; `docs/adr/0015` and the CRO audit of issue #56. [P]
- **Telegram Business `t.me/m/<slug>` view counters.** An aggregate integer that
  duplicates `contact_click`, behind a Premium subscription. [P]
- **WhatsApp Cloud API for the WhatsApp tile.** It would give the phone number on
  first message, but it means a Business account, a webhook, and the manager
  answering through an API inbox — for 4 of 22 visits. [P]
- **Viber `conversation_started`.** The one real pre-message identity signal on
  any platform, and Viber closed bot creation to commercial terms in February 2024. [P]

---

## 8. Unknown, unmeasured, and what would fix that

1. **The ghost rate itself is unmeasured today.** §2's 24-vs-10 is a commit
   message from 2026-09-24 and the store was not re-read. What would measure it:
   read `data/leads.json` from the Vercel Blob store and count, over a window,
   leads with `kind === 'call_click'` grouped by `status` and by whether
   `isPlaceholderContact(contact)` still holds — plus how many were upgraded by
   the merge window, which is visible as a `call_click` lead whose contact is no
   longer the placeholder, or as a comment containing `Сначала кликнул:`. One
   caveat baked into ADR 0029: the sweep sets `lost`, so **any lost rate drawn
   from this data counts ghosts**, and the query has to separate an
   operator-marked `lost` from a swept one (the swept ones carry `archived` too).
2. **Whether those visitors wrote in Telegram.** Unknowable from any system here —
   the manager's account is a human account. Only the operator knows, and the bot
   never asks. §7.6.
3. **Whether a programmatic or modal-initiated navigation to `https://t.me/…`
   opens the Telegram app or its website on iOS.** Apple documents only the tap
   case. The reported sub-500 ms limit comes from developer-forum threads, not
   owning documentation. **Device test required**, and it is the single thing that
   decides whether §7.3 is viable.
4. **Whether a `tel:` hand-off fires `visibilitychange` on iOS**, where a
   confirmation sheet appears over a page that stays visible. Not documented by
   MDN, WebKit or Chromium. Decides whether §7.4 can be triggered reliably.
5. **Whether the modern iOS long-press context menu dispatches a DOM `click`.**
   The only Apple statement found is from the archived pre-iOS-13 guide.
6. **What the current, post-revert shape converts at.** One day of data. Every
   number in §3 describes either the pre-detour shape or the eight days of the
   detour.
7. **Anything at all about carlab.rs and details.rs.** 77 and 58 visits, zero
   goals. No decision about their contact shape can be data-driven yet.
8. **The channel split's clientID exclusion.** Metrica's Reporting API has no
   `clientID` dimension, so the §3 channel table is Russia-excluded only. The
   Logs API has the field but not the goal parameters, so the two cannot be
   joined without the hit-level export.
9. **How much of the §3 drop belongs to the dark repaint rather than the tile
   detour.** The two overlap in time; see `docs/research/white-vs-dark-theme-lead-drop.md`.
10. **Whether Telegram Login works inside third-party in-app browsers**
    (Instagram, TikTok). Telegram's docs are silent; they warn only about
    `Cross-Origin-Opener-Policy: same-origin`.

---

## Sources

WHATWG and W3C:

- WHATWG HTML Standard, §6.4 _Tracking user activation_.
  <https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation>
- WHATWG HTML Standard, _Location-object navigate_.
  <https://html.spec.whatwg.org/multipage/nav-history-apis.html#location-object-navigate>
- WHATWG HTML Standard, _The rules for choosing a navigable_ (where the popup
  blocker lives).
  <https://html.spec.whatwg.org/multipage/document-sequences.html#the-rules-for-choosing-a-navigable>
- WHATWG HTML Standard, §7.4.2.3.4 _Non-fetch schemes and external software_.
  <https://html.spec.whatwg.org/multipage/browsing-the-web.html#non-fetch-schemes-and-external-software>
- WHATWG HTML Standard, `click()` and activation behavior.
  <https://html.spec.whatwg.org/multipage/interaction.html#dom-click>
- W3C Pointer Events Level 4, `click` and `auxclick`.
  <https://w3c.github.io/pointerevents/>

MDN:

- _Features gated by user activation_.
  <https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation>
- _Transient activation_ (glossary).
  <https://developer.mozilla.org/en-US/docs/Glossary/Transient_activation>
- `Window.open()`. <https://developer.mozilla.org/en-US/docs/Web/API/Window/open>
- `visibilitychange`.
  <https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event>
- `Document.visibilityState`.
  <https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState>
- `pagehide` / `pageshow`.
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event>,
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event>
- `unload` (deprecation warnings).
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event>
- `blur` on `Window`.
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/blur_event>
- `auxclick`.
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event>

Browser engines (source read directly):

- Chromium, `kActivationLifespan`.
  <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/public/common/frame/user_activation_state.h>
- Chromium, `SetHasUserGesture` on navigations.
  <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/renderer/render_frame_impl.cc>
- Chromium, external-protocol anti-flood gate.
  <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/external_protocol/external_protocol_handler.cc>
  and `external_protocol_observer.cc`
- Chromium Android, `ExternalNavigationHandler.java`.
  <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/external_intents/android/java/src/org/chromium/components/external_intents/ExternalNavigationHandler.java>
- Chrome, _User activation_ (stale on the duration).
  <https://developer.chrome.com/blog/user-activation>
- Chrome, _Page Lifecycle API_.
  <https://developer.chrome.com/docs/web-platform/page-lifecycle-api>
- Chrome, _Deprecating the unload event_.
  <https://developer.chrome.com/docs/web-platform/deprecating-unload>
- Chrome, _Back/forward cache_. <https://web.dev/articles/bfcache>
- WebKit, `defaultTransientActivationDuration`.
  <https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/LocalDOMWindow.cpp>
- WebKit, `shouldOpenExternalURLsPolicyToApply`.
  <https://github.com/WebKit/WebKit/blob/main/Source/WebCore/loader/FrameLoader.cpp>
- WebKit, `maximumIntervalForUserGestureForwarding`.
  <https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/UserGestureIndicator.h>
- WebKit, _New video policies for iOS_ (the call-stack rule, stated plainly).
  <https://webkit.org/blog/6784/new-video-policies-for-ios/>

Apple (all archived; no current replacement found):

- _Phone Links_.
  <https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html>
- _Support Universal Links_.
  <https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html>
- _Handling Events_ (Safari Web Content Guide).
  <https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html>

Messaging platforms:

- Telegram, _Deep linking_. <https://core.telegram.org/bots/features#deep-linking>
- Telegram, _Links_ (public username, bot, phone-number, business chat links).
  <https://core.telegram.org/api/links>
- Telegram, _Bot API_ (`Update`, `User`, `Chat`, `KeyboardButton`).
  <https://core.telegram.org/bots/api>
- Telegram, _Bots: an introduction for developers_ (bots cannot start
  conversations). <https://core.telegram.org/bots>
- Telegram, _Login Widget_ (now OIDC) and the archived legacy widget.
  <https://core.telegram.org/widgets/login>,
  <https://core.telegram.org/widgets/login-legacy>
- Telegram, _Business_. <https://core.telegram.org/api/business>
- WhatsApp Cloud API, webhook setup and payload examples.
  <https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks>,
  <https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples>
- Viber, _REST Bot API_ (`conversation_started`, commercial-terms notice).
  <https://developers.viber.com/docs/api/rest-bot-api/>
- Viber, _Deep links_. <https://developers.viber.com/docs/tools/deep-links/>

Practitioner and first-party conversion research:

- Google, _Google case study on app download interstitials_ (Morell, 2015).
  <https://developers.google.com/search/blog/2015/07/google-case-study-on-app-download-interstitials>
- Google, _Helping users easily access content on mobile_ (2016/2017).
  <https://developers.google.com/search/blog/2016/08/helping-users-easily-access-content-on>
- Google, _Avoid intrusive interstitials_.
  <https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials>
- Baymard Institute, _Checkout flow average form fields_.
  <https://baymard.com/blog/checkout-flow-average-form-fields>
- Baymard Institute, _Cart abandonment rate statistics_.
  <https://baymard.com/lists/cart-abandonment-rate>
- Baymard Institute, checkout methodology.
  <https://baymard.com/checkout-usability/methodology>
- Nielsen Norman Group, _Modal & Nonmodal Dialogs_ (Fessenden, 2017).
  <https://www.nngroup.com/articles/modal-nonmodal-dialog/>
- Nielsen Norman Group, _Accidental Dismissal of Overlays_ (2022, 8 participants).
  <https://www.nngroup.com/articles/accidental-overlay-dismissal/>
- Nielsen Norman Group, _Popups: 10 Problematic Trends and Alternatives_ (2019).
  <https://www.nngroup.com/articles/popups/>

In this repository:

- `docs/adr/0015-lead-form-asks-only-for-a-contact.md`,
  `docs/adr/0029-ghost-leads-retire-themselves.md`,
  `docs/adr/0005-telegram-bot-is-the-crm.md`
- `docs/guides/analytics.md`, `docs/guides/analytics-exclusions.md`, `AGENTS.md`
- `packages/site-kit/src/contactClick.ts`, `contactLinks.ts`,
  `contactPreference.ts`, `goals.ts`, `visitorId.ts`, `modalDialog.ts`
- `packages/lead-crm/src/routes/contactClick.ts`, `store.ts`, `schema.ts`,
  `form.ts`, `phone.ts`, `contactShape.ts`, `submitLeadForm.ts`,
  `telegram/format.ts`
- `apps/approved-rs/src/components/ContactCTA.astro`,
  `FloatingContactWidget.astro`, `apps/approved-rs/src/utils/contactChannel.ts`,
  `apps/approved-rs/src/utils/constants.ts`,
  `apps/approved-rs/src/pages/api/contact-click.ts`,
  `apps/approved-rs/src/pages/api/reminders.ts`,
  `apps/approved-rs/src/pages/api/telegram-webhook.ts`
- commits `d9716d5` (2026-09-24), `fd14760` (2026-10-02); issues #56, #91, #92
- `docs/research/white-vs-dark-theme-lead-drop.md`,
  `docs/research/how-many-ctas-in-a-hero.md`
- Yandex Metrica counters `111800377`, `112647692`, `112647721`, pulled in this
  session
