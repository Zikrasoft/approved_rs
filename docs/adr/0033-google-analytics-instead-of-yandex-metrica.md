---
status: accepted
---

# Google Analytics instead of Yandex Metrika

Decided 2026-10-14. Supersedes [ADR-0012](0012-yandex-metrica-only-starting-before-consent.md). Amended by [ADR-0044](0044-yandex-metrika-beside-ga4.md): Metrika is back beside GA4.

Yandex Metrika is removed from all three sites and replaced with GA4. The driver is consolidation into the Google ecosystem: carlab.rs already runs Google Ads (`AW-18508613563`, live campaigns), and GA4 is what lets that account see conversions and build remarketing audiences from the site — Metrika never could. All three GA4 properties live under one new Analytics account ("Zikrasoft"), and the carlab.rs property is linked to the existing Ads account.

ADR-0012 removed Google Analytics once already, for two reasons, and both are addressed rather than ignored:

**The 167 KiB of gtag.js.** `packages/site-kit/src/analytics.ts` already carried a `gtag` loader for carlab.rs's Google Ads conversion tag before this change. Adding the GA4 config is one more `gtag('config', …)` call on the same already-loading script — carlab.rs pays nothing extra. approved.rs and details.rs had no Ads tag and do take on a fresh gtag.js load; that cost is accepted in exchange for a single analytics mechanism across all three brands ([`feedback_mechanics_parity_all_brands`](../../AGENTS.md)), rather than GA4 on one site and something else on two.

**Starting before the consent answer.** This is unchanged. `defineAnalytics` in `packages/site-kit/src/analytics.ts` still queues the hit immediately and only an explicit refusal — read from the same `cookie_consent` storage — holds it back from the next load. The gate is our own code, not Google's Consent Mode; Google's official snippet and its consent-mode wiring are not used.

**What did not survive the move:** Metrika's `webvisor` session recording. GA4 has no equivalent, and no replacement ships with this change — a Microsoft Clarity add-on is tracked as a follow-up issue instead of blocking the migration on it.

**Event vocabulary:** `packages/site-kit/src/goals.ts` keeps the same identifiers except `order_placed` → `purchase`, GA4's standard ecommerce event name. The shop funnel (`add_to_cart`, `begin_checkout`, `purchase`) now carries GA4's standard `items[]` array instead of a bare `type`/`total`, so carlab.rs gets GA4's built-in ecommerce reports once the shop is live.
