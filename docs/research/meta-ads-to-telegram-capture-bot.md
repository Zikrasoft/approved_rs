# Meta ads that open the Telegram capture bot

Research date: **2026-10-12**. Question from the owner: can approved.rs run
Facebook/Instagram (Meta) ads that send people straight to our Telegram capture
bot (`https://t.me/ApprovedRsBot?start=<payload>`)? How should it be set up, and
can the ad pass the language so the bot opens in it?

## Source status

Same tags as `capturing-contact-before-the-messenger-opens.md`:

- **[P]** — primary source read in this session: a Meta or Telegram page on its
  own domain, or a file on `origin/main` of this repository.
- **[S]** — secondary: a third-party article or a search-engine summary of a page
  that would not render here.
- **[NOT ESTABLISHED]** — could not be verified from any available source.

One limitation shapes this note: **the Meta Business Help Center
(`facebook.com/business/help/…`) did not render in this session** — `curl`
returned Meta's generic error page and a real Chrome tab rendered no text. Meta's
Transparency Center (`transparency.meta.com`) and developer docs
(`developers.facebook.com`) did render, so Meta claims below come from those two.
Anything that only lives in the Help Center is marked accordingly.

Code was read at `origin/main` after `git fetch` (the working checkout is stale).

---

## Verdict first

1. **Linking a Meta ad to `t.me/…` is not prohibited by any Meta policy text
   found.** The Advertising Standards and the Spam standard regulate _what the
   destination does_ (matches the ad, no cloaking, no deceptive redirects), not
   which domain it is on. No Meta primary source found here names Telegram, or
   third-party messengers in general, as a restricted destination — but no
   primary source found here explicitly allows it either. **[NOT ESTABLISHED]**
   whether ad review treats `t.me` differently in practice.
2. **The cost of linking directly is measurement, not policy.** The Meta Pixel
   only runs on pages we serve; `t.me` is not one. A direct-to-bot ad gives Meta
   a link click and nothing after it, so Meta cannot optimise for leads.
3. **Recommended: ad → approved.rs landing page → Telegram tile.** The code
   already does almost everything: the tile carries `?start=<service>_<locale>`,
   the click beacon stores `location.href` (with Meta's `fbclid`/UTM in it) as
   the click Lead's `source_url`, and the visitor id in the payload merges the
   bot's Lead into that click Lead. What is missing is a Meta Pixel (with
   consent) and, optionally, a server-side Conversions API call.
4. **Language: yes, with the payload format we already ship.** `?start=sr` or
   `?start=vehicle-sourcing_sr` opens the bot in Serbian today. One ad (or ad
   set) per language, each with its own fixed link. Meta's dynamic URL
   parameters cannot be put _inside_ the `start` value in any way documented by
   Meta.
5. **A campaign tag in the payload is accepted but thrown away today.**
   `fb_sr` opens in Serbian, `vehicle-sourcing_fb_sr` opens Serbian with the
   service — but nothing stores `fb`. Keeping it needs a small change in
   `packages/lead-capture` + a Lead field in `packages/lead-crm` (§3.4).

---

## 1. Is a Meta ad allowed to link straight to a Telegram bot?

What Meta's primary text says about destinations:

- Ad review covers the destination, not just the creative: "the specific
  components of an ad, such as images, video, text and targeting information, as
  well as an ad's associated landing page or other destinations", and "The
  products and services promoted in an ad must match those promoted on the
  landing page." [P] [Advertising Standards — introduction](https://transparency.meta.com/policies/ad-standards/)
- The Spam standard bans **cloaking** ("intentionally presenting different
  off-platform content, such as URLs or applications, to our integrity systems
  versus what is shown to users"), **misleading links**, **deceptive redirect
  behavior** (an action is required and then "the domain name of the URL
  changes", or the page "automatically redirects users to a substantially
  different domain without any user action") and **deceptive landing page
  functionality**. [P] [Community Standards — Spam](https://transparency.meta.com/policies/community-standards/spam/)

Reading that against our setup:

- A `t.me` link is a different domain from the advertiser's, but it is the
  destination itself, not a redirect, and it delivers what the ad promises (a
  chat with Approved). Nothing in the quoted text makes that a violation. Our
  bot greets in the ad's language and shows the service the ad named, which is
  the "match" the standard asks for.
- An approved.rs landing page that **auto-redirects** to `t.me` would be the
  risky variant: it is close to the "automatically redirects users to a
  substantially different domain" wording. Do not build an interstitial that
  bounces to Telegram; let the visitor tap the tile. [P] same Spam page.
- The Transparency Center pages contain **no mention of messaging apps or
  Telegram** at all (checked: Advertising Standards intro, Spam standard,
  Circumventing Systems page, which only says business assets must follow the
  Account Integrity standard). [P] [Circumventing Systems](https://transparency.meta.com/policies/ad-standards/deceptive-content/circumventing-systems)
- The Help Center article _About ad destinations_
  (`facebook.com/business/help/1174990279685960`) is where a list of allowed
  destinations would live; it did not render. **[NOT ESTABLISHED]** whether it
  says anything about third-party messengers.
- Press coverage (2024) reported that Meta does carry ads linking to Telegram
  and that a research group found many of them violated _content_ rules. [S]
  [Marketplace, 2024-09-16](https://www.marketplace.org/episode/2024/09/16/telegram-linked-ads-on-meta-platforms-may-promote-illegal-activity-report-finds).
  Implication, not established: `t.me` destinations may attract extra
  scrutiny in review. Expect possible manual review; a rejection can be
  appealed.

**Does Meta prefer its own messengers?** Meta has first-class "click to
message" ad types with their own `destination_type` — `WHATSAPP`, Messenger,
Instagram Direct, and a multi-destination type that "picks the destination the
user is most likely to respond from". [P] [Ads that Click to WhatsApp](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp).
Their conversions are a separate `action_source`: `business_messaging` —
"Conversion was made from ads that click to Messenger, Instagram or WhatsApp."
[P] [CAPI server-event parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event).
Telegram has no such destination type; to Meta it is just a website URL. Whether
delivery or pricing favours Meta's own destinations is **[NOT ESTABLISHED]** —
no primary source states it.

**In-app browser behaviour.** Whether a `t.me` link tapped in the Instagram or
Facebook in-app browser opens the Telegram app directly or first shows
Telegram's web preview page with an "Open in Telegram" button is
**[NOT ESTABLISHED]** from a primary source. Test on a real iPhone and Android
with a dark post before spending. Note that Telegram's link spec says a bot
link with `start` shows a **Start** button "even if the user has already started
the bot" [P] [Telegram deep links](https://core.telegram.org/api/links) — so
returning users still deliver the payload.

## 2. The four setups compared

|                            | (a) Ad → `t.me` bot                              | (b) Ad → approved.rs page → tile → bot             | (c) Click-to-WhatsApp / Messenger / IG                          | (d) Telegram Ads                            |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| Meta Pixel fires           | No — Pixel is JS "on your website" [P]           | Yes (once installed)                               | n/a, Meta tracks the chat start itself                          | n/a                                         |
| What Meta can optimise for | Link clicks only                                 | Landing page views, `Contact`/`Lead` events        | Conversations; `business_messaging` CAPI events                 | —                                           |
| Lead lands in our CRM      | Yes, via `/start`                                | Yes, click Lead + bot Lead merged on visitor id    | **No** — WhatsApp/Messenger are not wired to `@podbor/lead-crm` | Yes, via `/start`                           |
| Source in the Lead         | Only what the payload carries (lost today, §3.4) | `source_url` = full landing URL incl. `fbclid`/UTM | —                                                               | Only the payload                            |
| Language                   | Fixed per ad via payload                         | Page locale → tile payload, automatic              | Ad copy only                                                    | Payload; ad must match channel language [P] |
| Policy risk                | Unknown review treatment of `t.me`               | Lowest — normal website ad                         | Lowest (Meta's own product)                                     | Telegram's rules, 160 chars                 |
| Extra friction             | None                                             | One extra tap                                      | None                                                            | None                                        |

Sources for the table: Pixel definition — "a snippet of JavaScript code … to
track Facebook ad-driven visitor activity on your website", installed in the
`<head>` "on every page where you will be tracking" [P]
[Pixel get-started](https://developers.facebook.com/docs/meta-pixel/get-started);
standard events `Contact` ("When a person initiates contact with your business
via telephone, SMS, email, chat, etc.") and `Lead` ("When a sign up is
completed") [P] [Pixel reference](https://developers.facebook.com/docs/meta-pixel/reference);
Telegram Ads rules below.

### (a) Direct to the bot

Cheapest to set up: paste `https://t.me/ApprovedRsBot?start=vehicle-sourcing_sr`
as the website URL. But Meta sees nothing after the click, so a Leads or Sales
objective cannot optimise, and reporting stops at CTR/CPC. The bot Lead has no
`visitorId` and no `source_url` (both `null` in `newLead`, `packages/lead-capture/src/route.ts`)
— the owner card cannot tell an ad lead from someone who found the bot by
search, unless the payload carries a tag and the code keeps it (§3.4).

### (b) Landing page first — recommended

What already works on `origin/main`, read from the code:

- Every Telegram tile is built by `captureBotLink(bot, locale, service)` →
  `?start=<service>_<locale>` or `?start=<locale>`
  (`packages/site-kit/src/contactLinks.ts`). [P]
- On tap, `defineContactClickTracking` appends the visitor id
  (`stampStartVisitor` → `<payload>_<32 hex>`, refused if over 64 chars) and
  beacons `/api/contact-click` with `source_url: location.href`
  (`packages/site-kit/src/contactClick.ts`). `location.href` on the landing page
  still carries the `fbclid` Meta appends and any UTM tags; `source_url` is
  capped at 500 chars (`MAX_URL_LENGTH`, `packages/lead-crm/src/form.ts`). [P]
- The bot strips the visitor id (`readStartVisitor`) and `insertOrMergeLead`
  merges its Lead into that click Lead, so the owner card gets the page. [P]
  Longest current payload: `vehicle-inspection_sr` (21) + `_` + 32 = 54 ≤ 64.

What is missing:

- **No Meta Pixel in the repo** (grep for `fbq`, `connect.facebook`, `fbclid`,
  `utm` on `origin/main` found nothing). Adding it means a new page-level effect
  in `bootSiteKit` behind the same analytics consent switch that already gates
  the visitor id, plus a `Contact` event on the tile click. Event names would
  go through `packages/site-kit/src/goals.ts` per AGENTS.md.
- **Conversions API (optional, later).** When the bot Lead is created, the
  server could post a `Lead` event with `action_source: "chat"` ("Conversion
  was made via a messaging app, SMS, or online messaging feature") [P]
  [server-event parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event),
  and `fbc` built from the stored `fbclid` — Meta documents building it
  server-side as `fb.1.<creationTime>.<fbclid>` and recommends "sending the fbc
  parameter with every event". [P] [fbp and fbc](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc).
  Constraints: `event_time` "can be up to 7 days before you send an event" [P]
  same server-event page. Meta's _CRM / Conversion Leads_ integration is
  **not** the fit: it is "currently only compatible with Facebook/Instagram's
  Lead Ads (Instant Forms)" and asks for 200+ leads/month. [P]
  [CAPI for CRM](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration).
  Whether Meta can attribute a `chat` event that carries only `fbc` (no email
  or phone) to the ad well enough to optimise on is **[NOT ESTABLISHED]**.

### (c) Click-to-WhatsApp / Messenger / Instagram

Meta's native path, with native conversion reporting. It needs a Page with a
linked WhatsApp number [P] (Click-to-WhatsApp page above). But the chats land
in WhatsApp/Messenger, not in our bot, so no Lead is created and the owner works
them by hand outside the CRM. Wiring WhatsApp Business Platform into
`@podbor/lead-crm` would be a project of its own. Not recommended unless the
owner prefers working leads in WhatsApp.

### (d) Telegram Ads

Telegram's own platform. Ads are "sponsored messages in public one-to-many
channels with 1000+ subscribers"; minimum CPM "0.1 Toncoin" [P]
[Getting started](https://ads.telegram.org/getting-started). Text up to "160
characters including spaces"; "If the destination is a Telegram bot, links may
include start parameters for the bot"; "The language of the targeted channel
should match the language of the ad and of the destination" [P]
[Ad guidelines](https://ads.telegram.org/guidelines). The payload rules of §3
apply unchanged. Payment is in Telegram's cryptocurrency (the homepage names
"Gram") [P] [ads.telegram.org](https://ads.telegram.org/) — whether a Serbian
company can buy it and book it cleanly is an accounting question
**[NOT ESTABLISHED]** here. Best fit for the Russian-speaking audience, which
already lives in Telegram channels.

## 3. Language through the payload

### 3.1 What Telegram allows

- `start`: "A-Z, a-z, 0-9, _ and - are allowed", "up to 64 characters", and
  base64url is recommended for anything else [P]
  [Bot features — deep linking](https://core.telegram.org/bots/features#deep-linking).
- The bot receives it as `/start <payload>` in a private chat [P] same page.
- `language_code` is an "IETF language tag of the user's language" [P]
  [Bot API — User](https://core.telegram.org/bots/api#user) and "an **optional
  field** – it could be empty" [P]
  [Bot features — language support](https://core.telegram.org/bots/features#language-support).
- No other query parameter of a `t.me` bot link is documented [P]
  [Deep links](https://core.telegram.org/api/links); whether Telegram passes
  extra ones (e.g. `&utm_source=…`) anywhere is **[NOT ESTABLISHED]** — assume
  only `start` reaches the bot.

### 3.2 What our bot does today (`packages/lead-capture/src/route.ts`, `origin/main`)

```ts
const startPayloadSchema = z
  .string()
  .max(START_PAYLOAD_LIMIT) // 64
  .regex(/^[A-Za-z0-9_-]+$/)
  .catch('')
  .transform(readStartVisitor); // strips a trailing _<32 hex> visitor id
```

Then `startFields` splits the rest on `_`:

- `service` = the **first** segment, only if there are 2+ segments and it is one
  of `vehicle-sourcing | vehicle-buyback | vehicle-inspection | vehicle-import`.
- `locale` = the **last** segment if it is `ru | en | sr | es | de`; otherwise
  the sender's `language_code` if it is exactly one of those; otherwise `ru`
  (`PRIMARY_LOCALE`). A tag like `en-US` is not a locale here, so it falls to
  `ru`.
- `referredBy: 'approved'` if the first segment is `from-approved` (sister-bot
  referrals; irrelevant on Approved's own bot).
- A payload over 64 chars or with any other character becomes `''` — the bot
  still opens, in the `language_code`/`ru` locale, no service.
- Everything between the first and last segment is **ignored**.

So these work **today, with no code change**:

| Link                                            | Bot opens in                                     | Service           | Stored marker |
| ----------------------------------------------- | ------------------------------------------------ | ----------------- | ------------- |
| `t.me/ApprovedRsBot?start=sr`                   | Serbian                                          | —                 | none          |
| `t.me/ApprovedRsBot?start=vehicle-sourcing_de`  | German                                           | Car sourcing card | none          |
| `t.me/ApprovedRsBot?start=fb_en`                | English                                          | —                 | `fb` dropped  |
| `t.me/ApprovedRsBot?start=vehicle-import_fb_ru` | Russian                                          | Import card       | `fb` dropped  |
| `t.me/ApprovedRsBot` (no payload)               | `language_code` if one of the five, else Russian | —                 | none          |

Rule for the owner: **one ad set per language**, its ads linking with that
language as the last segment. Do not rely on `language_code` — it is optional
[P] and often a UI language that does not match the ad.

### 3.3 Meta's dynamic URL parameters

Meta lets an ad add query parameters with placeholders such as
`{{campaign.name}}`, `{{adset.name}}`, `{{ad.name}}`, `{{ad.id}}`,
`{{placement}}`, `{{site_source_name}}` (`fb`/`ig`/`msg`/`an`) in the ad's
_URL parameters_ field. [S] — the Help Center page that defines them did not
render; this comes from third-party guides such as
[Jon Loomer](https://www.jonloomer.com/url-parameters-facebook-ads/). The
Marketing API field behind it, `url_tags`, is "A set of query string parameters
which will replace or be appended to urls clicked" [P]
[Ad Creative reference](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/).

Consequences for a `t.me` link:

- That field **appends separate `key=value` pairs** (`?start=sr&utm_campaign=…`).
  Telegram reads only `start` (§3.1), so the tags never reach the bot. Harmless,
  useless.
- Typing a placeholder _inside_ the website URL itself
  (`?start=fb{{ad.id}}_sr`) is not documented by Meta as substituted outside the
  URL-parameters field — **[NOT ESTABLISHED]**. If it is substituted:
  `{{ad.id}}` is digits (fits the charset); `{{campaign.name}}` and
  `{{ad.name}}` contain whatever the owner typed — a space, Cyrillic, `.` or
  `|` breaks the `[A-Za-z0-9_-]` rule and the whole payload becomes `''`, losing
  the language too. Length must stay ≤ 64.
- **Safe approach: hard-code the tag per ad**, e.g. `?start=fb-s1_sr`, and keep
  a sheet mapping `s1` → campaign/ad. No placeholders. On route (b) the
  dynamic parameters are fine, because they stay on the approved.rs URL and end
  up in `source_url`.

### 3.4 Keeping an ad tag — what the code would need (not implemented)

Today nothing stores the middle segments, and the Lead schema has no field for
it: `referredBy` is `z.enum(['approved'])`, `source_url` is `null` for a bot
Lead (`packages/lead-crm/src/schema.ts`, `route.ts` `newLead`). A minimal change:

1. Payload grammar `[<service>_][<tag>_]<locale>`, where `<tag>` matches e.g.
   `^(fb|ig|tg)-[a-z0-9]{1,16}$`. Max: `vehicle-inspection_` (19) + tag (19) +
   `_sr` (3) = 41, and a visitor id would not be stamped on an ad link anyway.
2. `startFields` returns `adTag: string | null` from the segment matching that
   regex (zod schema next to `startPayloadSchema`).
3. New Lead field, e.g. `adTag: z.string().nullable().default(null).catch(null)`
   in `baseStoredLeadSchema`, passed through `insertOrMergeLead` and set on
   resume like `referredBy`.
4. The owner card prints it (e.g. `Реклама: fb-s1`) in
   `packages/lead-crm/src/telegram/format.ts`.
5. Tests at 100% coverage in both packages. Because it changes
   `packages/lead-crm`'s Lead schema, **all three sites must ship together** —
   the CI filter already does that (AGENTS.md).

A zero-schema alternative is writing the tag into the bot Lead's `source_url`
(e.g. `tg:fb-s1`) — less code, but it overloads a field meant for a URL.

## 4. Recommendation for the owner

1. **Start with route (b).** Point Meta ads at the approved.rs service page in
   the ad's language (`/sr/vehicle-sourcing/` etc., `PathBuilder.sectionRoot`), with Meta's
   URL-parameters field set to UTM + `{{ad.id}}`. The page's Telegram tile
   already opens the bot in that language with that service, and the Lead
   already records the landing URL.
2. **Add the Meta Pixel first, behind the existing analytics consent**, firing
   `PageView` and `Contact` on a tracked contact click. Verify the domain in
   Business Manager. This is the piece that lets Meta optimise.
3. **Run one ad set per language** (ru / sr / en / de / es), each with ads
   linking only to that locale's pages. Keep creative and page in the same
   language — the "must match the landing page" rule [P].
4. **If testing direct-to-bot (a)**, use fixed links like
   `t.me/ApprovedRsBot?start=vehicle-sourcing_sr`, run it as a separate ad set
   with a Traffic objective, and judge it by Leads in the CRM per day, not by
   Meta's numbers. Ship §3.4 first if the owner wants those Leads labelled.
   Test the in-app browser hand-off on iOS and Android before spending.
5. **Conversions API from the bot later**, once there is enough volume to
   matter; first confirm (open question 3) that Meta credits `chat` events.
6. **Telegram Ads for the Russian audience** as a separate test, payload as in
   §3.2 with a `tg-` tag once §3.4 exists.

## Open questions

1. Does Meta ad review reject or slow down `t.me` destinations for a legitimate
   business? Only a real test ad answers it; the policy text found does not.
2. What does the Help Center _About ad destinations_ article list? It did not
   render here — read it in a logged-in browser.
3. Will Meta optimise on a CAPI `Lead` with `action_source: chat` and only
   `fbc`? Needs Events Manager's match-quality view after a test.
4. Does `{{ad.id}}` get substituted inside the website URL (not the URL
   parameters field)? One test ad with a placeholder in `start` would show it in
   the bot's `/start` text — but a broken substitution yields `''` and loses the
   language, so test it on a throwaway ad set.
5. Is buying Telegram Ads (crypto-denominated) workable for the company's
   accounting in Serbia?
6. Is a Pixel acceptable under the site's current consent model and Serbian data
   law? Not researched here.
