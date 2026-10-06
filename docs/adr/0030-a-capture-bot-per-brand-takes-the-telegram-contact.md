---
status: accepted
---

## Amended 2026-10-06: a Telegram tap stores a contact click again, for its page

This ADR held that a Telegram tile creates no contact click, because the bot's Lead would only be duplicated by it. That left every bot Lead without a page: `/start` carries at most 64 characters of `[A-Za-z0-9_-]`, so the URL the visitor tapped from cannot ride in it, and the operator card had no `Страница:` line.

So the tap beacons a contact click again, carrying the page and the visitor id, and the tile appends that id to the `?start=` payload as a last `_<32 hex>` segment — `stampStartVisitor` and `readStartVisitor` in `@podbor/site-kit/contact-links`, one owner for both ends. The bot creates its Lead through `insertOrMergeLead`, which lets a Lead carrying a `telegramId` absorb only a placeholder click, never a form Lead; whichever of the two writes lands second fills the gap, so the page survives either order. The duplicate this ADR feared does not appear: one Lead, one card, which the CRM now marks `🤖 через бота`.

What is still true: a tap that never reaches Start is now a Ghost lead again, retired by [ADR-0029](0029-ghost-leads-retire-themselves.md) like the other channels. A tap that cannot carry the id — analytics declined, or a payload past 64 characters — beacons nothing, so the bot writes its Lead alone and without a page rather than leaving a second, unmergeable card. The `contact_click` goal fires either way.

## Amended 2026-10-06: `/thanks/` on approved.rs opens the manager, not the bot

A visitor on `/thanks/` has just sent the form. They are the warmest person on the site, and the bot would ask them the two questions they just answered; worse, the bot's Lead merges only on `telegramId` while the form Lead merges on the visitor id, so one person got two cards. WhatsApp and Viber on that page already reach the human.

So that one Telegram tile opens the manager's account, `PUBLIC_TG_MANAGER`, through `telegramLink` with no `?start=`. The handle is an approved.rs environment variable, not a `packages/brands` field: it is a staff account, not brand identity. Unset, the tile falls back to the capture bot — a missing handle degrades the channel, it does not hide it. The page is read from the route, as the contact components already do for their placement. A tap there fires `contact_click` and writes no Lead of any kind; the other channels on `/thanks/` keep their contact click, which merges into the form Lead. Every other Telegram control on all three sites still opens its brand's capture bot with its payload.

# A capture bot per brand takes the Telegram contact before the conversation starts

Decided 2026-10-03.

A visitor taps the Telegram tile and never writes. The tap stores a Lead whose contact is a
placeholder, [ADR-0029](0029-ghost-leads-retire-themselves.md) retires it within 24 to 48 hours, and
the person is gone: nothing on our side can reach them, because the manager account is a human
account and the conversation never started. Telegram is the one channel where that is fixable
without asking the visitor for anything. A bot's first `/start` hands us the sender's `id`
unconditionally and their `username` when they have one — identity for free, before a single
message is typed. WhatsApp's Click-to-Chat tells the business nothing until the first message
arrives, Viber closed bot creation to commercial terms in February 2024, and a dialer tap is
invisible by construction, so **this decision is about Telegram alone and the other three channels
stay permanently dark.**

**The goal is reachability, not measurement.** Knowing that a tap failed recovers nobody; holding
something we can write to does. That is why the bot replaces the tile rather than instrumenting it.

**Four bots, and only one of them knows what a Lead is.** `@SerbCRMBot` is the CRM: cards, statuses,
deal amounts, commission, postpone, the reminder cron and shop-order notifications. `@ApprovedRsBot`,
`@CarLabRsBot` and `@DetailsRsBot` are capture bots, one per brand — they talk to visitors, write a
Lead to the shared store through their own site's route, and have no read, search or status surface
at all. Each capture bot's webhook is hosted by its own brand's project, which is what
[ADR-0014](0014-bot-webhook-and-cron-hosted-by-approved-rs.md) is narrowed to allow; the CRM webhook
and the cron stay on approved.rs. The card is still drawn by the CRM bot, which every site already
holds a token for.

**The brand comes from which bot received the update, never from the payload.** `?start=` is a string
the visitor controls, and `CONTEXT.md` states that a visitor can never name a brand. One shared bot
would have had to read the brand out of that string, so a crafted link could file a lead under
another brand and pick up its commission rate. Three capture bots make the brand a server fact
again. This is the whole reason there is more than one capture bot, and it is why the rejected option
in [ADR-0003](0003-one-bot-one-lead-store-brand-field.md) — "a bot per brand" — does not apply: that
option was three _CRM_ bots, with three chats and no single money summary. The CRM stays single.

**The payload is `<service>_<locale>`.** Telegram caps a `start` payload at 64 characters over
`A-Za-z0-9_-`; the longest service slug is `steering-wheel-restoration` at 26, slugs never contain an
underscore, so the separator is unambiguous and the budget is never close. Where a page has no
service — the homepage, the floating widget — the payload carries the locale alone and the card shows
`—` for the service, exactly as a homepage form lead does today. The locale travels in the payload
rather than being read from `language_code`, because the language the page was in is a better guess
than the language the client is configured in; `language_code` is the fallback when the payload is
absent. `?start=` and `?text=` are different parameters, so Telegram tiles lose `messengerPrefill`;
WhatsApp keeps it.

**The contact is whatever is reachable, in that order:** `@username` when the sender has one, the
phone number when they do not, and `tg://user?id=<id>` when they have neither. All three go in the
Lead's existing `contact` field — no new column, and no new vocabulary, because a Lead with a contact
is an ordinary Lead and `isGhostLead` stops matching it. A phone collected from someone who already
has a username goes in `comment` instead, since the username is where the conversation already is.

**Telegram's `username` is optional, and that is what shapes the handoff.** With a handle the owner
writes from their own account, as they do now. Without one, nobody but the capture bot can reach that
person, so the card offers a reply-through-the-bot fallback. That fallback is built for approved.rs
only: it needs the visitor's own capture bot, the operator's tap lands on the CRM webhook, and
approved.rs therefore holds all three capture tokens. CarLab and Details have had zero contact clicks
and zero form submissions over two months, so a relay for them would be built for nobody.

**The phone is an extra step with two different purposes.** `/start` does not carry a phone number;
only a `KeyboardButton{request_contact:true}` in a private chat produces one, and the visitor can
decline. With no username the ask is about reachability and comes first. With a username it is about
channel preference — a soft "want a call? share your number" at the end — and declining it costs
nothing.

**The card is posted on `/start` and edited as answers arrive.** Posting it at the end of the dialog
would hide exactly the people this decision exists for: the contact is already captured by then, so
an abandoned dialog is a success, not noise. The questions themselves are per-brand copy in each
app's own `src/content/i18n/*.yaml` — visitor-facing, so every locale that site serves, filled by
the existing translate job — not operator-facing Russian in the package.

**A Telegram tile no longer creates a contact click.** The capture bot writes a better Lead a moment
later, so the beacon would only produce a duplicate and a ghost. The `contact_click` goal still fires
in the browser, because it is the numerator of "tapped the tile" against "reached the bot"; the bot
cannot fire a Metrika goal, having no browser, so the denominator is counted in the lead store.

**A second `/start` from the same person is a second Lead**, matching "one request from one visitor",
except within 60 minutes — `VISITOR_MERGE_WINDOW_MS`, the window the store already uses — where it
continues the open one and skips the contact questions.

## Considered Options

- **A micro-modal on the tile asking for the handle before the messenger opens.** Technically sound:
  `location.assign` is not gated by user activation, so a modal that navigates from the visitor's own
  tap inside it is indistinguishable from a direct tap. Rejected because the experiment was already
  run and reverted here — `d9716d5` routed every messenger tile into the form, and its commit message
  carries the only ghost measurement that exists (of 24 such leads, 12 were never touched and none
  became a deal); eight days later the CRO audit priced the detour and `fd14760` undid it. A modal is
  the same detour, smaller. The full technical finding is in
  `docs/research/capturing-contact-before-the-messenger-opens.md`.
- **Outcome buttons on the click card («Написал / Не написал»).** Rejected: a ghost card is by
  definition one the operator never opened, so the buttons ask them to start touching exactly the
  cards they ignore. Answered unevenly, silence stops meaning anything and the data is worse than
  none.
- **Measuring the ghost rate from the lead store first.** Rejected: reachability is worth holding
  whatever the rate turns out to be, and Telegram is already the fattest channel — 15 visits against
  the phone's 8 over August and September.
- **telegraf, revisiting [ADR-0006](0006-no-telegram-bot-framework.md) and issue #41**, whose stated
  condition for a rerun — "the bot grows a complex conversational flow" — this decision meets.
  Rejected again, and the ADR's second reason gets stronger rather than weaker: the wizard's state
  belongs on the Lead the bot just created, not in a framework's per-user session store, and
  `pendingPrompt` already does exactly this for the operator — six `kind` strings across four ask sites. The capture wizard gets a field of its own rather than a seventh kind: `pendingPrompt` holds one prompt per Lead, and the CRM bot writes it whenever an operator edits that same Lead.
- **Three full CRM bots.** Rejected: it triplicates cards, reminders and order notifications and
  costs the single money summary, for a brand separation only the capture side needs.
- **Leaving the CRM on `@ApprovedRsBot` and giving approved.rs a fresh capture bot.** This was the
  recommendation; the owner chose to move the CRM instead, accepting the migration cost below.

## Consequences

- **Every card from before the switch loses its buttons, permanently.** `editMessageText` only works
  for messages the calling bot sent, so `@SerbCRMBot` cannot touch a card `@ApprovedRsBot` posted —
  neither the DM card nor the group teaser. Open leads at the moment of the switch have to be closed
  by hand or abandoned. Chosen over clearing the backlog first.
- **A bot Lead has no `source_url`.** The bot never sees the page, so the card's «Страница:» line is
  blank and the service token is all the page context there is. The first question covers it in prose
  instead.
- **The ghost rate stays unmeasured**, so there is no number against which to judge whether this paid
  off. The research file names the query that would produce one.
- **Four tokens live in the approved.rs project** — the CRM bot and all three capture bots — and the
  CRM token lives in all three projects.
- **The repeat-visit lookup is a stored `telegramId` on the Lead.** A comment marker was tried first
  and did not survive: the comment is truncated from the front once the dialog fills it, so the
  marker was the first thing to go. The field is written at `/start` and is what both capture
  lookups match on — together with the Lead's `brand`, because in a private chat the chat id is the
  user id and is identical in all four bots, so an unfiltered scan of the one shared store would
  resume another brand's Lead and bill it at that brand's commission.
- Dialog copy is three question sets, each in its own site's locales — five on approved.rs, three on
  carlab.rs and details.rs — and every string is visitor-facing, so the locale rule applies to all
  of it.
