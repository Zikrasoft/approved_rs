# Yandex Metrica only, started before the consent answer

All three sites use Yandex Metrica, one counter per domain, hard-coded in each `src/utils/constants.ts` rather than read from env (the ids are public anyway, and three Vercel dashboards would be a third place to get them wrong). Google Analytics was removed from all three, taking 167 KiB of gtag.js out of the bundle. The hit is queued on first load and `tag.js` is fetched after `load`, in idle time; the counter starts before the cookie-banner answer and only an explicit refusal stops it, from the next page load (a running Metrica counter cannot be unloaded). This is deliberate.

## Consequences

- `webvisor: true` records sessions, so every `LeadForm.astro` carries `ym-hide-content ym-disable-keys` and the privacy text says so. Changing the counter or its behaviour means updating the RU `privacy` section, `cookie.notice` and bumping `COOKIE_POLICY_VERSION`, or earlier consents silently start meaning something else.
- Event names live once in `packages/site-kit/src/goals.ts`; each must also be created by hand as a goal in all three counters (the Metrica API we use is read-only), or it is lost silently.
- Owners' and partner's browsers skew conversion roughly twofold. Their `clientID`s are kept out of the public repo (`.local/analytics-exclusions.txt`): a published list would turn any XSS into a targeted one. Filtering happens on Logs API exports, since the Reporting API has no `clientID` filter.
