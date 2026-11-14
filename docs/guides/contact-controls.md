# Contact controls: messengers, `tel:` and Telegram

House style for all three sites. Unqualified paths are relative to
`apps/approved-rs/`; `scripts/contact-controls-pass.ts` is at the repo root.

- **A messenger tap opens the messenger**, on all three sites. The tile's label
  promises a messenger, so it is a plain `<a>` to one — no modal trigger, works
  with JavaScript off. approved.rs routed these through the lead form until the
  CRO audit priced the detour (issue #56,
  `docs/adr/0015-lead-form-asks-only-for-a-contact.md`); do not re-add it. The
  form keeps its own doors there: the header CTA, the callback control, the
  partner block and the inline form in the same fold. The one step allowed
  before Telegram is the bot-or-manager choice below, because both of its
  options still open Telegram.
- **A `tel:` control only exists where a dialer does**, on all three sites.
  `createContactControls` in `@podbor/site-kit/contact-control` encodes the
  contract — the phone is `coarse-only`, the plain-number twin exists on
  `/thanks/` in the contacts block (`region: 'contacts'`, which the floating
  widget never passes) and wherever the call site passes `showNumber`, which
  names the control rather than the page: the header and the footer of all three
  sites, so a mouse can always read the number, the human Telegram only on
  `/thanks/` — and the
  placement says only where a click is recorded. The plain-number twin is a
  copy-number button (each app's `PhoneNumber.astro` with `copy`, the only
  markup in an app that renders the digits) carrying the same
  `data-contact-channel="phone"`, so a mouse click on it fires `contact_click`
  and stores a click Lead exactly like a `tel:` tap; tracking counts only the
  innermost tracked control, so one click is one Lead. Each app's
  `src/components/ContactControl.astro` is the only place that turns it into
  `pointer-fine:hidden!` / `pointer-coarse:hidden!` and reads the route for
  `onThanks`. Read those two instead of re-deciding a pointer rule at a call
  site; what stays per region is whether a callback button replaces the phone
  on a mouse. The `!` is load-bearing: Tailwind utilities sit in
  `@layer utilities` and lose to an unlayered Astro scoped `display`, so a
  plain `pointer-fine:hidden` on a `.contact-cell` silently does nothing. The
  compact hero may drop its phone on a mouse only while its lead-modal button
  stays unconditional — `cases/[slug].astro` renders no form of its own, and
  no check below sees whether a form is reachable. Verify with
  `node --experimental-strip-types scripts/contact-controls-pass.ts <base-url> <path>...`
  against a built site or a dev server: it drives both pointer variants
  through a device profile (a resized window still reports a fine pointer)
  and fails on a `tel:` link offered to a mouse or left in the tab order,
  fine-only markup on a touchscreen, or a control outside any
  `data-contact-placement`. Local only; CI gets the placement half from
  `.github/scripts/contact-placement.ts` in `check`.
- **No boolean rides down to a contact component to say which page it is on.**
  `ContactCTA direct`, `BaseLayout directContacts` and the `openModal` threaded
  through `ContactCTA` and `ClosingBand` are all gone (issue #92). What replaced
  them: the `/thanks/` carve-out is read from the route —
  `navCurrent(Astro.url.pathname, PathBuilder.thanks(locale)) === 'page'` —
  inside each app's `ContactControl.astro`, and in approved.rs's `ContactCTA`
  and `FloatingContactWidget` for the markup they drop there. `placement`
  only says where a click is recorded. And there is now one
  trigger attribute, `data-open-lead-modal`: a page that needs its own
  `LeadFormModal` — only `ServicePageLayout`, which carries the page's service,
  country, city and comment copy — renders it with `page`, and the modal script
  strips `trigger` off every unmarked `approved-modal` when a `page` one is
  present, so the page's modal is the only one that answers and the header's
  stands down. `DATA_OPEN_PAGE_LEAD_MODAL` is gone with it. Do not reintroduce a
  prop for either job: a call site that has to be told where it is, is a call
  site that will be told wrong.
- **Only approved.rs prefills the first message**, `messengerPrefill` in its
  `services.yaml`, so the chat does not open empty. The mechanism is shared and
  the brand sites opt in through the `prefill` option of
  `createContactControls`, which reaches WhatsApp only, as `text`. Viber's chat link has no such parameter, so Viber tiles stay bare —
  asymmetry by platform, not by choice.
- **A Telegram tile carries a `?start=` payload, not a prefill.** It opens the
  brand's capture bot through `createContactControls` in
  `@podbor/site-kit/contact-control`, which every app binds once over its own
  `BRAND.captureBot` as `contactControl` in `src/utils/contactLinks.ts` and
  renders through its own `ContactControl.astro` — a tile is that component,
  never a hand-built href or the bot name. A
  tracked Telegram tile must carry `?start=`: a Telegram link without it is
  treated as a human account, and a tap on it stores no Lead. `?start=`
  and `?text=` are different parameters, so `messengerPrefill` never reaches
  Telegram. The payload is `<service>_<locale>`, or the locale alone where the
  page has no service (the homepage, the footer, the floating widget, the
  contacts page); a component that sits on a service page takes the slug as a
  prop rather than reading it off the path. A Telegram tap stores a click Lead
  like every other channel, carrying the page and the visitor id, and
  `defineContactClickTracking` appends that id to the payload through
  `stampStartVisitor` in `@podbor/site-kit/contact-links` — the bot decodes it
  with `readStartVisitor` from the same module, so the wire format has one
  owner. The bot then goes through `insertOrMergeLead`, which lets a Lead
  carrying a `telegramId` absorb only a placeholder click, never a form the
  visitor already sent — that is how the owner card gets a `Страница:` line,
  and `telegramId` is what the card reads as `🤖 через бота`. A tap that cannot
  carry the id (analytics declined, or a payload past 64 characters) beacons
  nothing: the bot writes its Lead alone, without a page, rather than leaving a
  second, unmergeable card in the chat. The same holds on every channel: a
  tap with no visitor id beacons nothing, and `/api/contact-click` stores no
  Lead for one, so an anonymous beacon cannot flood the chat. **Every site has a `/thanks/`
  human-account carve-out, and approved.rs a second one.** The first is
  `/thanks/`: the visitor there has just sent the form, so its Telegram tile
  opens the manager's own account (`PUBLIC_TG_MANAGER`, an app variable and
  never a `packages/brands` field, because it is a staff account rather than
  brand identity) through `telegramLink`, with no `?start=`, and falls back to
  the capture bot when the variable is unset. The bound `contactControl`
  carries the handle as `humanTelegram` and picks it when `ContactControl.astro`
  reads `/thanks/` off the route — no prop says where a component is. The
  second is the footer's «Написать менеджеру» control and its icon twin: the
  label promises the manager, so the call site passes `manager`, which names
  the control rather than the page, and `createContactControls` picks the same
  `humanTelegram` on any page. **Every other tile that opens the bot asks
  first** ([ADR-0042](../adr/0042-telegram-tap-offers-bot-or-manager.md)):
  when `humanTelegram` is set, `createContactControls` stamps the manager's
  link on it as `data-telegram-choice`, and each app's `TelegramChoice.astro`,
  mounted once in the layout, is a `defineTelegramChoice` dialog that opens on
  that attribute and copies the tapped tile's stamped bot href into its bot
  option. One dialog per page, in the layout, not one per tile: a dialog inside
  the mobile menu goes inert when the menu closes on the tap. The tile keeps
  its own `data-contact-channel`, so the tap beacons exactly as before, and the
  two options carry none, so a choice is never counted twice. The capture
  bot's profile names the manager as well: `{manager}` in the `profile` copy
  of `captureBot.yaml` becomes `@` plus `PUBLIC_TG_MANAGER`. Each capture
  bot's «Написать менеджеру» menu button follows the same rule:
  `humanTelegram` in the app's `telegram-capture.ts`, read from that app's `PUBLIC_TG_MANAGER`, makes it a
  hand-off: the button stays a callback so the tap can first stamp
  `managerHandoff` on the Lead and post it to the Topic, then the screen offers
  the URL to the manager; unset it stays the in-bot manager screen. A
  tap on either site carve-out fires `contact_click` and writes no Lead:
  `defineContactClickTracking` skips the beacon for a `telegram` link whose
  href carries no `start` parameter — a human account, which a capture-bot
  link never is — so the rule is keyed on the link, not on the placement, and
  the fallback bot link beacons its placeholder like everywhere else. The
  other channels on `/thanks/` keep their click Lead,
  which merges into the form Lead on the visitor id.
