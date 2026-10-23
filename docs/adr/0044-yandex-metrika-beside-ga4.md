---
status: accepted
---

# Yandex Metrika beside GA4

Decided 2026-10-23. Amends [ADR-0033](0033-google-analytics-instead-of-yandex-metrica.md): GA4 stays, and Metrika comes back next to it on all three sites.

GA4 covers the Google Ads side ADR-0033 was about, and nothing in that reasoning is undone. What the switch cost was Metrika itself: Webvisor session recording, which GA4 has no answer to, and the counters' own history and goal setup, which never left the three counters (`111800377`, `112647692`, `112647721`). Running both costs one more idle-time script per site and gives back what the move dropped, so the Clarity follow-up (#287) is no longer needed.

The shape is the pre-ADR-0033 one, restored inside today's `defineAnalytics` in `packages/site-kit/src/analytics.ts`:

- `ymCounterId` is one more optional id next to `gaMeasurementId`, `metaPixelId` and `googleAdsId`, passed by each app's layout from `src/utils/analytics.ts`.
- Same gate as every other tag: queued on the first page view, `tag.js` fetched while the browser is idle, held back from the next load by an explicit refusal, never in dev.
- `init` with `webvisor`, `clickmap`, `trackLinks`, `accurateTrackBounce` and `ssr`, as before. The lead and checkout forms carry `ym-hide-content ym-disable-keys` again, so recordings keep the visitor's contact out.
- Every goal reaches Metrika under the same identifier from `goals.ts`. When a goal carries `value` and `currency`, Metrika also gets `order_price`, the parameter it reads revenue from, so `purchase` counts revenue without a second call shape.
