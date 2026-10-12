# Ad links straight to a Capture bot

How to point a Meta (or Telegram) ad at a brand's Capture bot so the Lead says
which ad it came from. Background and sources:
`docs/research/meta-ads-to-telegram-capture-bot.md`.

## The link

```
https://t.me/<CaptureBot>?start=[<service>_]<source>-<id>_<locale>
```

- `<source>` — `fb`, `ig` or `tg`.
- `<id>` — 1–16 letters or digits you choose per ad (`spring1`, `s1`). No
  spaces, dots, dashes or Cyrillic.
- `<service>` — optional, a service slug from `packages/brands`
  (`vehicle-sourcing`, `diagnostics`, …); opens that service's card.
- `<locale>` — the ad's language, one the brand serves; always last.

Examples:

| Link                                                      | Opens                      | Card shows                 |
| --------------------------------------------------------- | -------------------------- | -------------------------- |
| `t.me/ApprovedRsBot?start=fb-spring1_sr`                  | main menu, Serbian         | `📣 Реклама: fb · spring1` |
| `t.me/ApprovedRsBot?start=vehicle-sourcing_fb-spring1_ru` | Car sourcing card, Russian | `📣 Реклама: fb · spring1` |
| `t.me/CarLabRsBot?start=diagnostics_ig-oil2_en`           | Diagnostics card, English  | `📣 Реклама: ig · oil2`    |

A malformed tag is dropped silently: the bot still opens with the service and
the language, the Lead just carries no tag. Click the link yourself before
publishing and check the card.

## Rules

- **One ad set per language.** Each ad's link ends in that language; do not
  rely on the visitor's Telegram language.
- **Hard-code the tag per ad.** Meta's dynamic URL parameters
  (`{{ad.id}}`, `{{campaign.name}}`) land as separate query parameters, which
  Telegram drops — they cannot be put inside `start`. Keep a sheet mapping each
  `<id>` to its campaign and ad.
- **The whole `start` value stays within 64 characters.** The longest service
  slug plus a full tag and a locale fits with room to spare.
- The first tag on a Lead wins: a visitor who later taps another ad, or a site
  tile, keeps the original tag on the same Lead.
