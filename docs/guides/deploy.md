# Deploy: three sites and the shop backend on one VPS

## Stack

- **Astro v7** — static sites, with individual routes optionally on SSR
  (`export const prerender = false`)
- **pnpm v11 + Turborepo** — a monorepo, apps in `apps/*`, shared packages in
  `packages/*`
- **The VPS** (`infra/auto-service-shop`): Caddy serves each site's static
  files and proxies the rest to its node server, beside the shop backend
- **GitHub Actions** — the only place where a build or a deploy actually happens
  (`.github/workflows/ci.yml`), and where the sites' environment variables live

## Three sites, one repository

| App                 | Domain        | Brand                          | What it deploys                                                                                                                                 |
| ------------------- | ------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/approved-rs`  | `approved.rs` | Approved.rs — vehicle sourcing | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`                                                                       |
| `apps/auto-service` | `carlab.rs`   | CarLab: auto service           | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`, `/api/shop-orders`, `/api/telegram-webhook`, `/api/reminders` (cron) |
| `apps/detailing`    | `details.rs`  | Details — detailing            | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`                                                                       |

Each app owns its own `astro.config.mjs`, `keystatic.config.ts` and `.env*`.

**Four bots, one chat, one lead store, three brands.** `@SerbCRMBot` is the CRM
bot (cards, statuses, money, postpone and reminders), and it is the same bot
in all three projects; Telegram allows exactly one webhook
URL per bot, so `api/telegram-webhook.ts` and `api/reminders.ts` live only in
`apps/auto-service`. `@ApprovedRsBot`, `@CarLabRsBot` and `@DetailsRsBot` are
capture bots, one per brand: each one talks to visitors, writes a lead, and has
its own `api/telegram-capture.ts` webhook in its own project
([ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).
All three apps write to the same `crm` Postgres database
and are separated by the lead's `brand` field, which the server stamps on
(`createBrandBot({ brand })`) — a visitor cannot set it.

> Unprefixed paths in this document are relative to the app being discussed
> (`astro.config.mjs` in the approved.rs section means
> `apps/approved-rs/astro.config.mjs`). The repository root holds only `.github/`, the
> linter configs, `pnpm-lock.yaml` and a `vercel.json` carrying a single
> `git.deploymentEnabled: false`, like each app's.

---

## How the deploy works

### GitHub Actions builds, the VPS serves

`git.deploymentEnabled: false` in the root `vercel.json` and in each app's
`vercel.json` disables Vercel's own git trigger — for why, see
[ADR-0007](../adr/0007-github-actions-builds-vercel-only-hosts.md).

GitHub Actions builds and deploys, and only the sites that have fallen behind
`main` (see "Not everything gets deployed" below). The `deploy-site` job is a
matrix of the sites `.github/scripts/site-env.json` names (`verify` reads its
`sites` keys into the `sites` output); each leg runs
`.github/scripts/upload-site.sh <app> <sha>-<run>-<attempt>` from the repo root,
which:

1. writes the site env into a temp file (mode 0600) with
   `.github/scripts/site-env.ts`: the names the manifest
   `.github/scripts/site-env.json` gives that site, taken from the GitHub
   secrets and variables the step sees (see
   [Environment variables](#environment-variables)), and fails naming every
   required one that is missing. `CRM_DATABASE_URL` never comes from GitHub:
   compose sets it on the site container from the host's `CRM_DB_PASSWORD`,
   over anything the env file holds;
2. for carlab.rs, probes the shop backend (exit 75, see below) and sets
   `CATALOGUE_SHRINK_GUARD=true`;
3. builds with `turbo run build --filter=@podbor/<app> --env-mode=loose` under
   that env (`node --env-file`), with the secrets JSON and the deploy secrets
   unset;
4. rsyncs `dist/client` and `dist/server` to
   `/srv/sites/<app>/releases/<release>/` on the VPS, with `--link-dest` on
   `/srv/sites/<app>/current`: `--checksum` compares contents, since every build
   stamps new mtimes, and times are not preserved, so a file whose content did
   not change is hard-linked to the live release and never crosses the wire;
5. writes the same env into the release, `/srv/sites/<app>/releases/<release>/.env`
   (mode 0600, over ssh stdin, after the rsync whose `--delete` would remove
   it), and runs `/srv/carlab/deploy-site.sh <app> <release>`, which refuses a
   release without its `.env` and then switches two links in order: `running`
   (what the `site-<app>` container runs and reads its env from) first, then
   recreates the container and waits for it to answer `/`, and only then
   `current` (the directory Caddy serves static files from). So Caddy keeps
   serving the old static pages until node is healthy on the new release, and
   a release that fails its health check never has its files served: `running`
   goes back to the previous release, its container comes back, and `current`
   never moved. Compose reads the site env from
   `/srv/sites/<app>/running/.env`, so a rollback brings back the code and the
   env it ran with together.

The temp dir holding the env and the ssh key is deleted on exit; nothing is
printed or uploaded as an artifact. The release name carries the run id, so a
rebuild of the live SHA (a forced run) never writes into the release
that is serving. As a last step (`Record what is live`) the leg moves its own
`refs/tags/deployed/<app>` tag onto the SHA just shipped. That is how the next
run learns what is already in production. Each app deploys serially
(`concurrency: deploy-site-<app>`), the three in
parallel.

The Vercel projects no longer serve or hold anything.

Caddy sets the security headers on every response, static file or node: `frame-ancestors 'self'`,
`nosniff`, `strict-origin-when-cross-origin`, a `Permissions-Policy` with the
camera, microphone and geolocation off, HSTS, and a script CSP in
`Content-Security-Policy-Report-Only` that allowlists GA4, Google Ads, Metrika
and the Pixel beside `'self'` and the inline Astro scripts. They live in
`infra/auto-service-shop/caddy/security-headers.caddy`, generated from
`SECURITY_HEADERS` in `packages/site-kit`, whose CSP takes the tag hosts from
the analytics module; change it there and run
`.github/scripts/security-headers-drift.sh`, which also fails `check` on a hand
edit. Its `report-uri` is each site's `/api/csp-report`,
which logs one `[csp] <directive> <blocked host>` line per violation and nothing
about the visitor.

TODO: enforce the script CSP once a week of `[csp]` lines in the logs of
all three site containers shows no violation from the analytics scripts or the map embed.

### Job order

`check` (lint/prettier/typecheck/test, the shell tests for the scripts,
shellcheck, actionlint) → `translate` → `verify` → `deploy-site` (approved.rs,
details.rs, carlab.rs). Beside them, `shop-image` →
`deploy-shop` → `record-shop` ship the shop backend to its VPS (see
[the shop backend](#the-shop-backend-medusa-on-a-vps-apicarlabrs)), and
`deploy-site` waits for `shop-image` and `deploy-shop`, and holds every leg
back if either _failed_: the shop image carries the `crm` migrations, so a site
never ships against a schema that was not migrated. The
`deploy*` jobs only run on `main`, each only if the previous one passed. The workflow fires on a push to
any **branch** and never
on a tag: a tag filter without a branch filter would switch branches off entirely,
and on a tag checkout `translate` would find itself on a detached HEAD, unable to
push.

`translate` runs before the deploy rather than in parallel with it: the translation
scripts run, the commit with the translations goes into the same branch, and
everything downstream checks out exactly the SHA it left behind
(`needs.translate.outputs.sha`). If there was nothing to translate, that SHA is the
pushed commit itself. This makes it physically impossible for content to reach
production untranslated. `verify` tests what the translation commit changed on
that SHA (`turbo run test --filter="...[<pushed SHA>]"`, so only the apps whose
content moved and whatever `git pull --rebase` brought in): `translate` pushes as
`GITHUB_TOKEN`, and such a push starts no new run — otherwise nobody would check
the translated tree. When nothing was translated the SHA is the pushed one, which
`check` already tested, and `verify` runs no tests at all.

### What `check` tests

Lint, prettier, the YAML and Russian-copy checks, pinned versions, the
security-headers drift, the Caddy split check, the migration manifest, shellcheck and actionlint run on every
push. Typecheck, tests, the approved.rs and details.rs builds with their
contact-placement check, and the shop's Docker Postgres, migration drift and
`infra/auto-service-shop/test/*.test.sh` run only for what changed since the
newest commit every app has passed CI with:
`.github/scripts/check-base.sh` takes the merge-base of the `deployed/*` tags
(they move only after `check` passed and the deploy finished) and the step runs
`turbo --filter="...[<base>]"`, dependents included. The shop counts as changed
when turbo names `@podbor/auto-service-shop` or anything under
`infra/auto-service-shop/` moved. `check` tests everything when there is no
`deployed/*` tag, a tag is not an ancestor of `HEAD`, the merge-base is not
itself a deployed commit, a root build file or anything under `.github/`, the
eslint or prettier config changed, or a `workflow_dispatch` run sets `force`.

### Not everything gets deployed

A push to `main` no longer ships all three sites. The `scope` step in the `verify`
job assembles the list of apps that are stale in production, and both deploy jobs
read it through `needs.verify.outputs.changed`.

The comparison base is **not the previous commit but the `refs/tags/deployed/<app>`
tag**, which each deploy job moves onto the shipped SHA. The difference matters:
`github.event.before` answers "what changed in this push", while the question is
"what is in production right now". An app whose deploy failed and which has not
changed since would never appear in a diff against the previous commit — and would
stay stale until the first incidental edit in its directory. With the tag it appears
in the list on every subsequent push until the deploy succeeds: only a successful
deploy moves the tag.

The list is assembled per `apps/*/` like this:

| What `scope` sees                                                            | Decision |
| ---------------------------------------------------------------------------- | -------- |
| the `deployed/<app>` tag does not exist yet                                  | deploy   |
| the tag is not an ancestor of `HEAD` (force-push, branch rollback)           | deploy   |
| a root build file changed (list below)                                       | deploy   |
| `turbo --filter="...[<tag>]"` names the package as changed                   | deploy   |
| turbo failed, or its output could not be parsed                              | deploy   |
| `apps/auto-service-shop`: something under `infra/auto-service-shop/` changed | deploy   |
| turbo affirmatively said the package is not among the changed ones           | skip     |

**Any uncertainty answers "deploy"**, and the `...[<tag>]` filter has leading dots,
so an edit in `packages/*` ships all three sites. Why that is, and why the filter
must not be narrowed —
[ADR-0008](../adr/0008-deploy-only-what-is-stale-in-production.md).

**Root files are checked with a separate `git diff`.** turbo attributes changes at
the repository root to the `//` package rather than to the apps, so a dependency
bump would not enter the `...[tag]` filter at all and would ship nothing. The
`scope` step looks at them itself:

```
pnpm-lock.yaml  pnpm-workspace.yaml  turbo.json  package.json
.npmrc  .node-version  .pnpmfile.cjs  .github/actions/setup-pnpm/action.yml
```

Any change to those ships every app whose `deployed/*` tag is older than the
change. The list lives once, in `.github/scripts/root-changed.sh`, which `check`
reads too. If a new file starts affecting the build, it has to be added there. The rest of `.github/` is deliberately not tracked:
otherwise any workflow edit would ship all three sites. By the same logic
`setup-pnpm` installs the whole workspace in every job; until that measurably
hurts, we don't introduce `pnpm install --filter`.

### The `deployed/*` tags

`refs/tags/deployed/approved-rs`, `deployed/detailing` and `deployed/auto-service`
appear and move on their own: the last step of each deploy job
moves its tag onto the shipped SHA through `gh api` (`PATCH` with `force`, or `POST`
if the tag does not exist yet).

These are **housekeeping tags, not release tags.** They mark no versions, take no
part in release notes, and exactly one step — `scope` — reads them.

- **Deleting one is not an incident.** The next run will not find it, will answer
  "deploy" and will create it again. The cost is one surplus deploy, and only one.
- **Deleting one is also the standard way to redeploy a single site:**

  ```bash
  git push origin :refs/tags/deployed/detailing
  # then Actions → CI → Run workflow on main
  ```

- **Moving a tag forward by hand is, by contrast, dangerous.** It tells CI that a
  commit is in production when it is not, and the next push will skip the deploy.
  When in doubt, delete rather than move.

If everything needs redeploying at once — Actions → CI → Run workflow, with the
**Deploy every app, whatever the tags say** checkbox. It is for when something
changed outside git: a GitHub secret or variable of a site, a rotated secret. Such edits require a rebuild but leave no trace in
the repository's history, and `scope` only looks at git.

`environment: site-<app>` on each `deploy-site` leg is an ordinary GitHub Environment with no protection rules: it
holds that site's own secrets and variables. `deploy-shop` keeps
`environment: production`.

### A consequence: environment variables live in GitHub

The build runs with the env the manifest assembles, and the server runs with
the same file. Which means:

- **variables are set in GitHub, never in Vercel.** Settings → Secrets and
  variables → Actions: a shared value once at repository level, a per-site one
  in that site's environment (see [Environment variables](#environment-variables));
- **a missing public variable fails the build, a missing server-side one fails the
  route.** `PUBLIC_*` variables are inlined into the HTML at build time, so each
  app's `src/utils/constants.ts` parses them through a zod schema at module load
  and the build dies naming the variable that is unset or empty, instead of
  shipping `undefined` in the markup (`https://t.me/undefined`). Server-side
  variables are checked at runtime and fail the route with a 500 in production;
- **changing a variable only takes effect after a new deploy** — the existing build
  already holds the old value inside its HTML.

---

## Environment variables

**One manifest, `.github/scripts/site-env.json`, lists every name a site gets.**
Each entry is `"secret"` or `"variable"`, where it is kept, with a trailing
`?` when the name is optional (`"secret?"`, `"variable?"`), or `"unset"`:

- `shared`: one value for all three sites, set **once at repository level**
  (Settings → Secrets and variables → Actions → Repository);
- `sites.<app>`: set in that site's GitHub environment, `site-approved-rs`,
  `site-auto-service` or `site-detailing`. `unset` marks a name the site's code
  reads (through a shared package) but that site deliberately leaves out;
- `notInSiteEnv`: names the code reads that never come from GitHub, with where
  they come from instead (`CRM_DATABASE_URL` from compose, and so on).

Non-secret values (`PUBLIC_*`, `SITE`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`, URLs,
the CRM bot's username) are GitHub **Variables**; everything else is a
**Secret**. A secret set as a variable does not count: the deploy reads each
name only from the side the manifest names.

The deploy step gets two env values, `SITE_SECRETS` and `SITE_VARS`.
`SITE_VARS` is `toJSON(vars)`. `SITE_SECRETS` is a JSON object the workflow
spells out name by name (`"X": ${{ toJSON(secrets.X) }}`), because GitHub holds
a workflow that dumps `toJSON(secrets)` as possibly malicious until someone
approves the run. A new secret name therefore goes into the manifest and into
`ci.yml`; `site-env.test.ts` fails until the two agree.
Why the rest is safe: GitHub masks every secret in the log whatever the step
does with it; `site-env.ts` copies only the manifest's names for that site into
the release `.env` and never prints a value (a refusal names the variable only);
and `upload-site.sh` unsets both JSON values and the deploy secrets before the
build, so pnpm, turbo, Astro and every dependency they run never see a secret
outside the site's own env. Only the one deploy step carries them, not the job.

`.github/scripts/site-env.test.ts` scans what each app reads
(`process.env.X`, `import.meta.env.X`, `requireEnv('X')`, the env zod schemas)
in `apps/<app>/src`, `astro.config.mjs`, `keystatic.config.ts` and the
`packages/*` it depends on, and fails on a name the manifest does not list for
that site. A new variable lands in the manifest in the same change, or `check`
goes red. A value holding a single quote or a line break is refused by name:
the `.env` quotes values in single quotes, which compose and `node --env-file`
both read literally.

**A missing required name fails the deploy**, naming it, before anything is
built. Keystatic's own names are read inside `@keystatic/astro`, which the scan
cannot see; the manifest lists them by hand.

`PUBLIC_*` variables are visible in the browser — no secrets there.

### Public (contacts, inlined into the HTML)

| Variable                 | approved.rs | carlab.rs   | details.rs  | Default in the schema        | Without it                  |
| ------------------------ | ----------- | ----------- | ----------- | ---------------------------- | --------------------------- |
| `PUBLIC_WHATSAPP_NUMBER` | ✅ required | ✅          | ✅          | none / `PUBLIC_PHONE_NUMBER` | the build fails / the phone |
| `PUBLIC_VIBER_NUMBER`    | ✅ required | ✅          | ✅          | none / `PUBLIC_PHONE_NUMBER` | the build fails / the phone |
| `PUBLIC_PHONE_NUMBER`    | —           | ✅ required | ✅ required | none                         | the build fails             |
| `PUBLIC_THREADS_CHANNEL` | ✅ required | —           | —           | none                         | the build fails             |
| `PUBLIC_TG_MANAGER`      | ✅          | ✅          | ✅          | none (optional)              | see below                   |

`PUBLIC_TG_MANAGER` is the manager's own Telegram handle, without `@`:
`approvedrs` on approved.rs and details.rs, `carlabrs` on carlab.rs. Each
capture bot's «Написать менеджеру» menu button links to it; unset, the button
opens the in-bot manager screen instead. On approved.rs the footer's «Написать
менеджеру» and the Telegram tile on `/thanks/` link to it too; unset, they open
the capture bot.

### Google rating (carlab.rs, build time only)

`GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACE_ID` let the carlab.rs build read the
workshop's rating and review count from Places API (New) (`rating`,
`userRatingCount`). The key is a secret: restrict it to the Places API (New).
The Place ID comes from Google's Place ID Finder for the workshop's Maps card.
They live in the `site-auto-service` environment only. Unset, or when the API fails or answers something
malformed, the build logs a warning and shows `GOOGLE_RATING` from
`src/utils/constants.ts`, so update that by hand now and then. The number
refreshes only when carlab.rs deploys.

### Analytics — no environment variables

The GA4 measurement ids and the Meta Pixel id are baked into each
`src/utils/analytics.ts` and are never read from the environment: they are not
secrets, they are publicly visible in any request from the site, and spreading
them across three GitHub environments would create a third place to get them
wrong.

| Site        | GA4 Measurement ID | Metrika     | Meta Pixel          | Google Ads       |
| ----------- | ------------------ | ----------- | ------------------- | ---------------- |
| approved.rs | `G-KRZTP1VX7D`     | `111800377` | —                   | —                |
| carlab.rs   | `G-DNDDCQWYRR`     | `112647692` | `29229430643330595` | `AW-18508613563` |
| details.rs  | `G-XH3F0PZNCC`     | `112647721` | —                   | —                |

Each domain has its own GA4 property, under the "Zikrasoft" Analytics account;
reusing another's is not allowed. Yandex Metrika runs beside GA4 on all three,
one counter per domain, under the same gate
([ADR-0044](../adr/0044-yandex-metrika-beside-ga4.md), amending
[ADR-0033](../adr/0033-google-analytics-instead-of-yandex-metrica.md)).

All three behave the same way: `gtag('config', …)` is queued on the first page
load, and `gtag/js` itself is fetched after `load`, while the browser is idle —
it is off the critical path, but not one pageview is lost because of it. On
carlab.rs, the same already-installed gtag.js (loaded for the `AW-18508613563`
Google Ads tag) also carries the GA4 config — no second script. An explicit
refusal in the banner takes effect from the next load — there is no way to
unload a tag that has already started. Metrika's `webvisor` session recording
is on; the lead and checkout forms carry `METRIKA_MASK_CLASS` so
their contents stay out of it.

**If you change a measurement id, or enable analytics somewhere it was
absent**, three things travel with it: the Russian `privacy` section in
`src/content/i18n/pages.yaml`, the `cookie.notice` string in
`site.yaml`/`dictionary.yaml`, and `COOKIE_POLICY_VERSION` in
`src/utils/constants.ts`. Without bumping the version, consent quietly starts
meaning something different for everyone who already answered the banner.

approved.rs's `src/utils/constants.ts` uses `!` with no fallback — an unset variable
gives `undefined` in the markup. carlab.rs and details.rs have fallbacks to
placeholder numbers: the site will not break, but it will show the wrong contact,
which is worse than a broken link because it goes unnoticed.

`PUBLIC_WHATSAPP_NUMBER` and `PUBLIC_VIBER_NUMBER` are per site (each brand has its own numbers); `PUBLIC_PHONE_NUMBER` is shared. On approved.rs, `PUBLIC_WHATSAPP_NUMBER` doubles as the number for an ordinary call
(`PHONE_NUMBER` there is an alias of it).

### Telegram (needed by all three projects)

Four bots, and the variables split along that line. The CRM bot `@SerbCRMBot` is
one bot shared by the three projects; each brand's capture bot is its own.

| Variable                              | approved.rs | carlab.rs | details.rs | Bot     | Without it                                                                     |
| ------------------------------------- | ----------- | --------- | ---------- | ------- | ------------------------------------------------------------------------------ |
| `TELEGRAM_BOT_TOKEN`                  | ✅          | ✅        | ✅         | CRM     | `/api/leads` and `/api/contact-click` answer 500                               |
| `TELEGRAM_BOT_USERNAME`               | ✅          | ✅        | ✅         | CRM     | the same — 500                                                                 |
| `TELEGRAM_GROUP_ID`                   | ✅          | ✅        | ✅         | CRM     | the same — 500                                                                 |
| `TELEGRAM_OWNER_ID`                   | ✅          | ✅        | ✅         | CRM     | this brand's leads never reach the owner's DMs                                 |
| `TELEGRAM_ADMIN_ID`                   | ✅          | ✅        | ✅         | CRM     | this brand's leads never reach the admin's DMs                                 |
| `TELEGRAM_WEBHOOK_SECRET`             | —           | ✅        | —          | CRM     | `/api/telegram-webhook` answers 401 to everything — the bot's buttons are dead |
| `TELEGRAM_CAPTURE_BOT_TOKEN`          | ✅          | ✅        | ✅         | capture | this brand's capture bot never answers a visitor and no lead is written        |
| `TELEGRAM_CAPTURE_WEBHOOK_SECRET`     | ✅          | ✅        | ✅         | capture | `/api/telegram-capture` answers 401 to everything — the Telegram tile is dead  |
| `TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED` | —           | optional  | —          | capture | owner messages in an Approved.rs Topic are reported undelivered                |
| `TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS`  | —           | optional  | —          | capture | owner messages in a Details Topic are reported undelivered                     |

> **The main trap when setting up new projects.** All three `src/lib/crmBot.ts`
> call `requireEnv('TELEGRAM_BOT_TOKEN')`, `requireEnv('TELEGRAM_BOT_USERNAME')` and
> `requireEnv('TELEGRAM_GROUP_ID')` at module top level. The `/api/leads` and
> `/api/contact-click` routes are `prerender = false`, so **the build succeeds** and
> the first real request in production is what fails. It is easy to ship a "green"
> deploy with a dead form.

Every bot token, CRM and capture alike, must be BotFather's `<digits>:<secret>`
shape — even a placeholder for local runs (`1:fake`). The Telegram client reads
the bot id before the colon when the module loads and throws on anything else.

`TELEGRAM_OWNER_ID` / `TELEGRAM_ADMIN_ID` are numeric Telegram user ids (not
`@username` — get them from [@userinfobot](https://t.me/userinfobot)),
comma-separated if a person has several accounts (`111,222`). Their absence does not
fail the route — it just means direct messages about this brand's leads go nowhere.
`TELEGRAM_OWNER_ID` is shared, one value at repository level; `TELEGRAM_ADMIN_ID` is per site, because each brand can have its own admin.

The **CRM** bot is shared across brands: `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME` and `TELEGRAM_GROUP_ID` are set once at repository
level, and `TELEGRAM_WEBHOOK_SECRET` only in `site-auto-service`, which hosts
that one bot's webhook.

The **capture** bots are not. `TELEGRAM_CAPTURE_BOT_TOKEN` is `@ApprovedRsBot`'s
on approved.rs, `@CarLabRsBot`'s on carlab.rs and `@DetailsRsBot`'s on
details.rs — three different tokens from @BotFather, never copied between
projects: which bot received the update is what tells the server the brand, so a
shared token would hand a visitor the choice. `TELEGRAM_CAPTURE_WEBHOOK_SECRET`
is per project too, and on carlab.rs it is a **different** value from
`TELEGRAM_WEBHOOK_SECRET` — the two webhooks there belong to two different bots
and do not share a secret. carlab.rs additionally holds the other two capture
tokens as `TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED` and `TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS`:
whatever the owner writes in a Lead's Topic lands on the CRM webhook there, and
only the visitor's own brand's bot can deliver it, so the webhook picks the bot by
the lead's `brand` ([ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).
Without a sibling token every owner message in that brand's Topics is answered
with an "undelivered" notice in the Topic.

### Meta Conversions API

| Variable              | approved.rs | carlab.rs | details.rs | Without it                                                              |
| --------------------- | ----------- | --------- | ---------- | ----------------------------------------------------------------------- |
| `META_CAPI_TOKEN`     | —           | ✅        | —          | no server `Lead` event reaches Meta; `[meta-capi] off` in the logs      |
| `META_CAPI_TEST_CODE` | —           | testing   | —          | events go to production; set it only while checking Events Manager Test |

The token is a Conversions API access token generated in Events Manager for the
site's own pixel (`META_PIXEL_ID` in `src/utils/analytics.ts`) — a secret, server
only, never `PUBLIC_`. A site without a pixel id sends nothing even with a
token. What fires and when: [analytics.md](analytics.md#the-server-lead-event-from-a-capture-bot).

### Storage and cron

| Variable           | approved.rs | carlab.rs | details.rs | Without it                                              |
| ------------------ | ----------- | --------- | ---------- | ------------------------------------------------------- |
| `CRM_DATABASE_URL` | ✅          | ✅        | ✅         | leads are not stored and the routes fail                |
| `CRON_SECRET`      | no          | ✅        | no         | `/api/reminders` answers 401, the digest never goes out |

### Shop Orders (ADR-0053)

| Variable                       | approved.rs | carlab.rs | details.rs | Without it                                                                                                 |
| ------------------------------ | ----------- | --------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `SHOP_API_URL`                 | ✅          | ✅        | no         | ✅/❌ on a `parts-order` Lead never completes or cancels its shop Order; no «🔎 Искал» lines               |
| `SHOP_ORDER_OUTCOME_SECRET`    | no          | ✅ secret | no         | same                                                                                                       |
| `SHOP_LEAD_SECRET`             | no          | ✅ secret | no         | `/api/shop-orders` answers 401 to the shop, a shop cancel never marks a Lead lost, «Сделать кейс» gets 401 |
| `SHOP_VISITOR_SEARCHES_SECRET` | ✅ secret   | ✅ secret | no         | no «🔎 Искал» lines                                                                                        |
| `SHOP_CLIENT_SECRET`           | no          | ✅ secret | no         | all shoppers share one store rate-limit bucket                                                             |
| `SHOP_EVENTS_SECRET`           | no          | ✅ secret | no         | carlab.rs sends no Events to the shop's log; the shop's own Events still log                               |

`SHOP_INTERNAL_URL` is set by `docker-compose.yml` on `site-auto-service` alone
(`http://medusa:9000`, the shop over the `data` network): the running server
calls the shop there instead of at `MEDUSA_BACKEND_URL`, which the Mac runner's
build keeps using, and an unset or invalid value falls back to `MEDUSA_BACKEND_URL`.

`SHOP_API_URL` is the shop's public API origin, `https://api.carlab.rs`. When
the bot marks a `parts-order` Lead ✅ it completes the Order, ❌ cancels it,
through `POST /hooks/carlab-orders/:id/outcome` with
`Authorization: Bearer $SHOP_ORDER_OUTCOME_SECRET`. That route is not under
`/admin`, and the secret can do
nothing but complete or cancel an Order. `SHOP_ORDER_OUTCOME_SECRET` is one
value set twice, on carlab.rs and in the shop's `.env`
(`openssl rand -hex 32`); unset in the shop, the route answers 401 to
everyone. A call that fails stays pending on the Lead and `/api/reminders`
retries it every day until the shop takes it.
`SHOP_LEAD_SECRET` is one value set twice, on carlab.rs and in the shop's
`.env` (`openssl rand -hex 32`): the shop posts every placed Order and every
cancel to carlab.rs's `/api/shop-orders` with it as a Bearer token, and the route
refuses any Lead naming an Order without it, so a visitor cannot attach a Lead
to someone else's Order. The same secret goes the other way for «Сделать кейс»: carlab.rs's
`/api/admin/work-draft` reads `GET /hooks/carlab-orders/:id/case-summary` from
`MEDUSA_BACKEND_URL` with it, and the shop answers only with the car, the Parts
and the RSD total of a completed Order. The draft Work is then committed with
the staff member's own Keystatic GitHub login; the shop holds no repository
token.
The CRM bot uses `SHOP_API_URL` and `SHOP_VISITOR_SEARCHES_SECRET` to read
`GET /hooks/visitors/:visitor_id/vin-lookups`, the last three VIN searches of a
CarLab Lead's visitor, and lists them as «🔎 Искал» lines on the group card
(sent by carlab.rs) and on the DM detail (built by carlab.rs's CRM webhook).
approved.rs and details.rs Leads never query the shop. The secret is one more
value set twice, on carlab.rs and approved.rs and in the shop's `.env`, apart
from `SHOP_LEAD_SECRET`, so approved.rs holds a key that can only read VIN
searches and never post an Order to carlab.rs. Either side without both
variables shows the card without them; a shop that does not answer
within three seconds does too. The visitor id reaches the shop because
`bootSiteKit` mirrors it into the first-party `visitor_id` cookie, which the
server-rendered VIN search reads and sends in the `/store/vin-lookups` body.
`SHOP_CLIENT_SECRET` is a separate value set twice the same way, on carlab.rs
and in the shop's `.env`: every catalogue call carlab.rs makes for a visitor
carries it in `x-shop-client-secret`, so the shop's store rate limits count the
visitor named in `x-shop-client` instead of Vercel's egress. For one release
the shop also takes `SHOP_LEAD_SECRET` on that header, so a carlab.rs still
sending the old secret keeps its per-visitor buckets: set `SHOP_CLIENT_SECRET`
in the shop first, restart it, then on carlab.rs and redeploy.
`SHOP_EVENTS_SECRET` is one more value set twice, on carlab.rs and in the shop's
`.env`: carlab.rs's search, cart, checkout, lead and CSP-report routes post one
Event per request to `POST /hooks/storefront-events` with it as a Bearer token
(ADR-0057), through `inBackground` with a 2-second timeout, so a slow or refusing
shop never slows or fails the visitor. The secret can do nothing but add a line
to the log. Unset on carlab.rs, nothing is sent; unset in the shop, the route
answers 401.

**Rotating either secret without downtime.** Every side that checks a Bearer
secret also accepts `<NAME>_PREVIOUS`, optional: the shop checks
`SHOP_ORDER_OUTCOME_SECRET`, `SHOP_LEAD_SECRET`, `SHOP_CLIENT_SECRET`,
`SHOP_EVENTS_SECRET` and `SHOP_VISITOR_SEARCHES_SECRET`, carlab.rs checks
`SHOP_LEAD_SECRET`; a side only ever
sends the current value.

1. Make a new value (`openssl rand -hex 32`).
2. On every side that holds the secret, move the old value to
   `<NAME>_PREVIOUS` and put the new one in `<NAME>`: for
   `SHOP_LEAD_SECRET`, `SHOP_CLIENT_SECRET` and `SHOP_EVENTS_SECRET` that is
   carlab.rs (no `_PREVIOUS` for `SHOP_CLIENT_SECRET` or `SHOP_EVENTS_SECRET`
   there, it only sends) and
   `/srv/carlab/.env`, for
   `SHOP_ORDER_OUTCOME_SECRET` carlab.rs (no `_PREVIOUS` there, it only sends)
   and `/srv/carlab/.env`, for `SHOP_VISITOR_SEARCHES_SECRET` carlab.rs and
   approved.rs (no `_PREVIOUS` on either, they only send) and
   `/srv/carlab/.env`. Redeploy carlab.rs or approved.rs and restart the
   shop (`docker compose up -d medusa`), in any order: while the sides differ,
   each still takes the other's old or new value.
3. Once both sides run the new value, empty `<NAME>_PREVIOUS` everywhere and
   redeploy or restart again.

`CRM_DATABASE_URL` is not a GitHub value: compose sets it on every site
container (see "The `crm` database shared by three sites").

### Keystatic (needed by all three projects)

| Variable                           | Public  | Without it                               |
| ---------------------------------- | ------- | ---------------------------------------- |
| `KEYSTATIC_GITHUB_CLIENT_ID`       | no      | signing in to `/keystatic` fails in prod |
| `KEYSTATIC_GITHUB_CLIENT_SECRET`   | no      | the same                                 |
| `KEYSTATIC_SECRET`                 | no      | the same (it signs the session cookie)   |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | **yes** | the sign-in button leads nowhere         |

The values **differ** between the three sites, so each lives in its site's
environment: each site has its own GitHub App, see the "Keystatic: three
GitHub Apps" section. `KEYSTATIC_SECRET` is an arbitrary random string,
distinct per site.

### `SITE`

A special case: it does not need setting at all (the manifest takes it as an
optional variable per site).

- the site's URL is hardcoded as `site:` in each app's `astro.config.mjs`, and that
  is where Astro fills `import.meta.env.SITE` from, which `src/utils/constants.ts`
  reads. A `SITE` environment variable does not affect that value — Astro inlines
  only `PUBLIC_*` and its own built-in keys into `import.meta.env`;
- in practice, only the local `scripts/register-webhook.ts` reads
  `process.env.SITE` (from the `.env.local` handed to `--env-file`), and it is
  the host the webhook is registered against — so point it at the `.env.local`
  of the project that hosts that bot's webhook, which for a capture bot is that
  brand's own project, and `https://crm.carlab.rs` for the CRM bot and
  approved.rs's capture bot.

Changing the domain means editing `site:` in `astro.config.mjs` and the host
Caddy serves it on (`APPROVED_HOST`, `CARLAB_HOST`, `DETAILS_HOST` in the
shop's compose), not a GitHub variable.

---

## The `crm` database shared by three sites

Leads, digests and the Balance live in one Postgres database, `crm`, inside the
shop's Postgres on the VPS (`infra/auto-service-shop`), next to but separate
from the shop's own `carlab` database. The bot and the cron live only in
carlab.rs and have to see all three brands' leads, so **all three sites get
the same `CRM_DATABASE_URL`**:

```
CRM_DATABASE_URL=postgres://crm:<CRM_DB_PASSWORD>@postgres:5432/crm
```

`postgres` resolves on the compose `data` network. Compose sets this URL on
every `site-<app>` service from the host's `CRM_DB_PASSWORD` (never from
Vercel), puts it on `networks: [data, edge]` and starts it only once Postgres
is healthy. Brands are separated by the lead's `brand` field
(`Approved.rs` / `CarLab` / `Details`), stamped by the server.

1. Put `CRM_DB_PASSWORD=$(openssl rand -hex 32)` into `/srv/carlab/.env`.
2. `./deploy.sh` (or `./crm-role.sh` alone) creates the `crm` role and the
   `crm` database it owns; the role can reach nothing else, and `PUBLIC` loses
   `CONNECT` on both databases.
3. Every shop deploy then migrates `crm` (see "CRM migrations" below), so
   the schema is in place before any site starts.
4. Move the old Blob data in during the cutover window (below). From
   `packages/lead-crm`, with `BLOB_READ_WRITE_TOKEN` from any of the three
   Vercel projects,
   `node --env-file=<env> --experimental-strip-types scripts/import-blob.ts --dry-run`
   prints counts only (Leads, digests, operations, prompts, unreadable records,
   staff notes, comments kept whole, skipped order markers), never contents.
   Without `--dry-run` and with `CRM_DATABASE_URL` set, it runs in one
   transaction and inserts only what is not there yet, keyed on the old
   numeric ids (`legacy_id`), digest days, prompt keys, ledger ids and payload
   hashes. A row a previous run imported is left exactly as it is, since staff
   may have changed its status or notes since, so a rerun only adds what
   reached Blob in between. Each Lead keeps its old id as its `number` (what
   the bot shows as `#123`). After the first run the sequence for new Leads
   continues at the highest imported number + 1000: the gap is reserved for
   the Leads that still reach Vercel while DNS moves, which the second run
   inserts with their own numbers. A Lead whose number is already taken stops
   the import, which then changes nothing, and it goes in by hand.

   Staff notes were appended to the Lead's comment as signed lines
   (`16.10.2026 · Админ: Звонил`). The import moves each such line into
   `lead_notes` with its author and that day, and leaves the visitor's text in
   the comment. Where a signed line is followed by a line that is neither
   another dated line nor `Отложено до <date>` (a note written over several
   lines, or a visitor message appended after it), the import cannot tell
   where the note ends, so it keeps that comment whole, notes and all, and
   counts it under `commentsKeptWhole`. Unsigned `Отложено до <date>` lines
   stay in the comment, since they never named an author. The Blob store is
   only read.

### Cutover from Vercel

The leads storage and the CRM bot switch together, in **one window**: the bot
must read and write the same Leads as the sites that capture them. The bot
does not wait for approved.rs's DNS: its webhook and approved.rs's capture bot
answer on `crm.carlab.rs` (`CRM_HOST`, see [The Telegram webhooks](#the-telegram-webhooks)),
and the reminder cron runs on the host, so approved.rs may move later than the
other two. Until it does, its form and contact clicks still land in Blob on
Vercel: their cards reach the chat, their buttons answer only once an import
has taken them, so rerun the import while that lasts. Nothing here prints a
secret; keep it that way.

**Before the window**

0. **Env into GitHub, before merging the self-hosting PR (#465).** The
   deploy reads the sites' env from GitHub from then on, so it has to be
   there first. On the owner's Mac, logged in to both CLIs (`vercel login`,
   `gh auth login`; install the CLI with `npm i -g vercel@59.11.7` if
   `vercel --version` finds none), from the repository root:

   ```bash
   node --experimental-strip-types .github/scripts/env-to-github.ts --dry-run
   node --experimental-strip-types .github/scripts/env-to-github.ts
   ```

   It links each Vercel project (`approved-rs`, `auto-service`, `detailing`
   under the team `aleksey-zikrackiys-projects`; `VERCEL_TEAM=<slug>`
   overrides it) inside a private temp dir, `vercel env pull`s its production
   env there and deletes the dir on exit. A shared name whose value differs
   between projects stops the run before anything is written, naming the
   variable and which projects agree (never a value): make the projects agree
   in Vercel, or set that one by hand in GitHub, and run again. Otherwise it
   creates the `site-*` environments that are missing and writes every
   manifest name with `gh secret set` / `gh variable set` from stdin, shared
   ones at repository level, the rest into their site's environment. The dry
   run pulls and prints the same names and destinations and writes nothing.
   Both print `missing:` for a required name no project has (set it in
   GitHub by hand, or the deploy fails naming it) and `not migrated:` for a
   project name outside the manifest (legacy, or infra such as
   `CRM_DATABASE_URL`: check it is not a variable the manifest forgot).
   Done: Settings → Environments lists the three `site-*`, and the dry run
   prints no `missing:` line you did not expect.

Steps 1 and 2 are also done **before merging #465**: the merge's first CI run
ships the new stack files to the host ("Ship the stack files") and then runs
`deploy.sh`, which refuses to start without `CRM_DB_PASSWORD` in
`/srv/carlab/.env`, leaving the host with the new files and the old
containers; the site legs after it need `rsync` and `/srv/sites`.

1. **Host prerequisites.** On a host bootstrapped before the sites moved, copy
   `infra/auto-service-shop/bootstrap-host.sh` over and rerun it as root: it
   installs `rsync`, makes `/srv/sites` and enables the `carlab-reminders`
   timer. Stop that timer until the window
   (`sudo systemctl disable --now carlab-reminders.timer`), or it posts a
   digest from the host while Vercel still posts its own. A day ahead, lower
   the TTL of the three apex and `www` records to 300 s.
2. **Password.** Append `CRM_DB_PASSWORD=$(openssl rand -hex 32)` to
   `/srv/carlab/.env` on the host (mode 600). It lives only there, never in
   Vercel or GitHub.
3. **Database.** Ship the shop (a push to `main` that deploys
   `auto-service-shop`, or `./deploy.sh <live sha>` on the host): `crm-role.sh`
   creates the role and database, `deploy.sh` migrates it. Check with
   `docker compose exec -T postgres psql -U carlab -d crm -c '\dt'`. The
   shop deploy also creates the `running` link beside an existing `current`,
   so it runs before the first site deploy.
4. **Sites on the host.** Let `deploy-site` ship all three (delete their
   `deployed/*` tags or run CI with **Deploy every app**). They answer only
   through Caddy, whose hosts still resolve to Vercel, so no visitor reaches
   them yet. If Grafana was left running from a look, stop it
   (`docker compose stop grafana`): the budget with the three sites counts it
   off.
5. **Import env.** On the owner's Mac, open the crawler's tunnel
   (`ssh -i ~/.ssh/carlab-crawler -N -L 15432:10.200.0.10:5432 crawler@<IPv4>`,
   see [the crawler](#the-crawler-on-the-owners-mac)) and write a local env
   file (mode 600) with `BLOB_READ_WRITE_TOKEN` and
   `CRM_DATABASE_URL=postgres://crm:<CRM_DB_PASSWORD>@127.0.0.1:15432/crm`.
   From `packages/lead-crm`, run
   `node --env-file=<env> --experimental-strip-types scripts/import-blob.ts --dry-run`
   and check the counts, `commentsKeptWhole` included.

**The window**, between two 08:00 UTC digests, in this order. Ask the owner
and the admin not to press any CRM button from step 1 until step 6: the
first import is final for every Lead it takes, so a status changed on Vercel
after it is lost.

1. **Cron off on Vercel.** Vercel → the approved.rs project → Settings → Cron
   Jobs: disable it. The last Vercel deployment keeps calling its own
   Blob-backed `/api/reminders` otherwise.
2. **First import.** Run `scripts/import-blob.ts` without `--dry-run`. The
   sequence now continues at the highest imported number + 1000. The
   `shop-orders/*` markers stay in Blob (the run only counts them as
   `orderMarkersSkipped`): nothing has read them since the old shop went, and
   the unique `(brand, order_id)` on `leads` is what keeps one order to one
   Lead now.
3. **DNS.** Point the apex and `www` A records of carlab.rs and details.rs,
   and `crm.carlab.rs`, at the reserved IP, and remove any AAAA record that
   still names Vercel. approved.rs's apex and `www` go in the same step when
   its registrar allows, or later (step 7).
4. **Caddy.** As soon as the three names resolve to the host
   (`dig +short <domain> A` against a couple of public resolvers), force a
   Caddy reload so it asks for the certificates at once
   (`docker compose exec -T caddy caddy reload --force --config /etc/caddy/Caddyfile --adapter caddyfile`).
   A plain `caddy reload` with an unchanged Caddyfile does nothing and leaves a
   failed ACME attempt waiting out its backoff; `--force` reapplies the config
   and starts the certificate requests again
   and open each site. Register the CRM bot and approved.rs's capture bot on
   `https://crm.carlab.rs` (see [The Telegram webhooks](#the-telegram-webhooks)),
   and point any other bot webhook that named a Vercel URL at its domain again.
5. **Cron on the host.** `sudo systemctl enable --now carlab-reminders.timer`.
6. **Second import.** Once every resolver you check answers with the host and
   Vercel's logs show no more `/api/*` calls (wait out the 300 s TTL, then a
   margin), run the import again. It inserts the Leads that reached Blob while
   DNS moved, each with its own number inside the reserved gap, and leaves
   everything the first run imported alone. Then delete the local env file,
   unless approved.rs is still on Vercel.
7. **approved.rs, if it moved later.** Rerun the import once a day until its
   apex and `www` resolve to the host; after the DNS change, `caddy reload
--force` as in step 4, a last import once Vercel's logs show no more
   `/api/*` calls, then delete the local env file. Every run takes only the
   Leads it has not taken yet, each keeping its Blob number.

**After the window.** The three Vercel projects stay for a week as the
fallback, but they must not serve anyone. Check, and keep checking for that
week:

- each domain is removed from its Vercel project (Settings → Domains), so a
  stale record cannot route to it;
- Deployment Protection (Vercel Authentication) covers production, so the
  `*.vercel.app` URLs of the last deployments answer 401 instead of taking
  Leads into Blob;
- `getWebhookInfo` names `crm.carlab.rs` for the CRM bot and approved.rs's
  capture bot, and their own domains for the other two capture bots, never a
  `vercel.app` URL;
- the Cron Job stays disabled, and Vercel's logs show no function calls.

After the week, delete the Blob store and the three Vercel projects: they hold
nothing the sites need any more, the env lives in GitHub. Then the
`VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID*` repository secrets can
go too: no workflow reads them.

### CRM migrations

`deploy.sh` runs `prisma migrate deploy` for `crm` on every shop deploy, after
`crm-role.sh` and before anything restarts, in a one-off container of the new
shop image: `@podbor/lead-crm` is a shop dependency, so the image already
carries the lockfile-pinned Prisma CLI with its linux-musl schema engine, and
the package ships `prisma/` beside it. The site containers stay plain node with
no CLI in them. A failed migration fails the deploy before `MEDUSA_TAG` moves.
The `shop-image` job migrates a blank database with the built image, so a
broken migrator fails CI before it reaches the host.

Any change under `packages/lead-crm` makes the shop a dependent in turbo's
`...[tag]` filter, so a new CRM migration always ships with a shop deploy, and
`deploy-site` waits for it. `deploy.sh` refuses to start while
`CRM_DB_PASSWORD` is unset, before it touches anything: the sites keep their
Leads in `crm`, so a deploy that skipped its migrations would leave them
reading a schema that is not there.

**Every CRM migration is additive**, like the shop's: the running sites keep
serving the previous build while the new schema lands, and a rollback brings
an older shop image over a newer schema. Add a column nullable or with a
default, add a table or an index; a rename or a drop ships in two deploys,
first the code that stops reading the old shape, then the migration. Generate
one with `pnpm --filter @podbor/lead-crm exec prisma migrate dev --name <name>`
against the local test database and commit it: Prisma applies the folders in
name order, so every one, `20261116000000_init` included, starts with its
timestamp. The migration files are frozen by `packages/lead-crm/migrations.sha256`,
which `.github/scripts/migrations-frozen.sh` checks in `check`, as the shop's
are; append a new migration's line in the same commit.

The nightly `backup.sh` dumps `crm` beside `carlab` (`crm-<stamp>.dump`, same
retention and off-host copy) once `CRM_DB_PASSWORD` is set, which is why
approved.rs's own `scripts/backup-leads.ts` and `scripts/restore-leads.ts` are
gone. Restore it with
`docker compose exec -T postgres pg_restore -U carlab -d crm --clean --if-exists --no-owner --role=crm --single-transaction <crm-<stamp>.dump`.

Locally, `docker compose -f packages/lead-crm/docker-compose.test.yml up -d`
gives a throwaway Postgres on `127.0.0.1:55452`; point `CRM_DATABASE_URL` at
`postgres://postgres:postgres@127.0.0.1:55452/crm` and run `db:deploy`. The
tests start their own container on a free port and remove it afterwards.

---

## Keystatic: three GitHub Apps

All three `keystatic.config.ts` files talk to the same repository in production
(`storage: { kind: 'github', repo: 'Zikrasoft/approved_rs' }`) and differ only in
their path prefix (`APP_ROOT = 'apps/<app>/'`). But a GitHub App's OAuth callback is
fixed and tied to a domain:

```
https://<domain>/api/keystatic/github/oauth/callback
```

Three domains mean three separate GitHub Apps, each installed on the same
`Zikrasoft/approved_rs` repository.

For each:

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
2. Callback URL as above, with that site's domain
3. Permissions: Repository permissions → Contents: Read and write
4. Install App → onto the `Zikrasoft/approved_rs` repository
5. Generate a client secret
6. Put `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
   `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` (the slug from the app's URL) and a random
   `KEYSTATIC_SECRET` of its own into the site's GitHub environment
   (`site-<app>`): the slug as a variable, the other three as secrets

Local development does not go through the GitHub App: `import.meta.env.PROD` is
`false` there and Keystatic writes straight into the working copy
(`storage: { kind: 'local' }`).

The slug is needed by the `/keystatic` client bundle, so it is inlined at build
time; the three secrets are read only by the server.

A site without these variables builds, deploys and serves every page; only signing
in to `/keystatic` is dead, and only once somebody tries — carlab.rs and details.rs
lived that way for twelve days. To check by hand:
`curl -o /dev/null -w '%{http_code}' https://<domain>/api/keystatic/github/login`
— it should be 307, not 500.

---

## GitHub Actions secrets

Settings → Secrets and variables → Actions:

| Secret                              | For what                                       | Where to get it                                             |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `OPENAI_API_KEY`                    | the `translate` job (content auto-translation) | OpenAI                                                      |
| `AUTO_SERVICE_SHOP_VPS_HOST`        | the shop deploy (the server's reserved IPv4)   | `terraform output ipv4`                                     |
| `AUTO_SERVICE_SHOP_VPS_USER`        | the shop deploy                                | `deploy` (created by `bootstrap-host.sh`)                   |
| `AUTO_SERVICE_SHOP_VPS_SSH_KEY`     | the shop deploy (CI's private key)             | `ssh-keygen -t ed25519`; the public half gets `restrict`    |
| `AUTO_SERVICE_SHOP_VPS_KNOWN_HOSTS` | the shop deploy (the host key)                 | `ssh-keyscan -t ed25519 <IPv4>`, fingerprint verified apart |

`AUTO_SERVICE_SHOP_VPS_*` are **repository** secrets, not `production` environment
secrets: `shop-image` has no environment, and with environment secrets it would not
push the image while `deploy-shop` would try to pull a tag that does not exist.
Until all four are set, `shop-image` does not push and `deploy-shop`'s `guard` step
prints "`AUTO_SERVICE_SHOP_VPS_* secrets are not set, skipping the shop deploy.`", and the
workflow stays green. A site leg has no such guard: without them, or without a
required name from the manifest, it fails, naming what is missing.

The sites' own secrets and variables are not in this table: the manifest
`.github/scripts/site-env.json` lists them (see
[Environment variables](#environment-variables)).

> With the `deployed/*` tags, `deploy-site`'s `guard` skips a deploy for an
> entirely normal reason: "`<app> is current in production, skipping`": the
> site has not changed since the last ship. That is it working, not a broken
> configuration.

### Job permissions

`GITHUB_TOKEN` is granted per job rather than for the whole file. Four jobs hold
`contents: write`, for two different reasons:

| Job           | `permissions`                       | Why exactly that much                                                                        |
| ------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `check`       | `contents: read`                    | a checkout with `fetch-depth: 0`, for the `deployed/*` tags its test scope starts from       |
| `translate`   | `contents: write`                   | commits and pushes translations into the same branch                                         |
| `verify`      | `contents: read`                    | a checkout with `fetch-depth: 0`; the `deployed/*` tags arrive with the history              |
| `shop-image`  | `contents: read`, `packages: write` | pushes `ghcr.io/zikrasoft/podbor-auto-service-shop:<sha>` and `podbor-carlab-caddy:<sha>`    |
| `deploy-shop` | `contents: read`, `packages: read`  | hands the server a one-shot token for `docker pull`; that token cannot write to the repo     |
| `record-shop` | `contents: write`                   | moves `deployed/auto-service-shop` after a successful `deploy-shop`, a separate job for that |
| `deploy-site` | `contents: write`                   | moves `refs/tags/deployed/<app>` after a successful deploy of that app                       |

Write access for `translate` and write access for the deploy jobs are different
things: the first changes a branch's contents, the second touches only housekeeping
tags. Moving `deployed/auto-service-shop` is its own `record-shop` job on purpose:
`deploy-shop` sends its `GITHUB_TOKEN` to the server (a one-shot GHCR login), and a
token that can write to the repository has no business being there. An accepted
risk: that same token also carries `contents: read`, so while the job is alive the
private repository can be read from the server. Beyond `contents`, the workflow asks
only for `packages`, and only in the two shop jobs.

Both deploy jobs check out with `persist-credentials: false`. They need the token
only on the last step, where it is passed explicitly through `GH_TOKEN`, and in
between the build executes the repository's code, so there is no reason to leave
it a write-capable token recorded in `.git/config`.

Two traps, both of which look like "the site secrets broke" while having nothing
to do with them:

- Settings → Actions → General → Workflow permissions must be **Read and write**.
  With "Read repository contents", both `translate` and the tag step fail, with
  "Resource not accessible by integration".
- Tag protection rules must not cover `deployed/*`. If they do, the site ships and
  the job goes red afterwards: the tag stays old, and the next run ships the same
  site again.

---

## The shop backend: Medusa on a VPS (`api.carlab.rs`)

`apps/auto-service-shop` is docker compose on a single DigitalOcean
Droplet in Frankfurt (`fra1`, Ubuntu 24.04, Basic `s-2vcpu-4gb`: 2 vCPU, 4 GB,
80 GB SSD, 4 TB transfer, $24 a month, IPv4 only). The S3 buckets and IAM users
stay on AWS in `eu-north-1`: AWS would not enable a 4 GB Lightsail plan for the
account. All of it is described in `infra/auto-service-shop/`:

| File                                     | What it is                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile` + `Dockerfile.dockerignore` | the production image: `pnpm --filter @podbor/auto-service-shop build`, `pnpm deploy --legacy`; runtime from `.medusa/server` as `node`                               |
| `docker-compose.yml`                     | postgres 16.15, typesense 30.2, medusa and caddy 2.11.8 (both GHCR images by the same sha)                                                                           |
| `caddy-image/Dockerfile`                 | Caddy 2.11.8 built with `cache-handler` v0.17.0 and Souin's `simplefs` storage v0.0.23, plus `curl` for the purge; built by CI, pulled from GHCR by sha              |
| `caddy/Caddyfile`                        | `api.carlab.rs` and `admin.carlab.rs` → `medusa:9000`, TLS, security headers, body up to 1 MB on the API host and 25 MB on the admin host, payment webhooks closed   |
| `production.env.example`                 | the template for `/srv/carlab/.env`                                                                                                                                  |
| `backup.env.example`                     | the template for `/srv/carlab/.env.backup`, the off-host backup bucket                                                                                               |
| `deploy.sh`, `backup.sh`, `restore.sh`   | shipping, the nightly backup and its off-host copy (`backup.sh fetch` pulls one back), restore                                                                       |
| `crawler-role.sh`                        | the crawler's Postgres role, run by `deploy.sh` and `restore.sh` after the migrations                                                                                |
| `move-static-to-s3.sh`                   | once: copies the old `static` volume to the public bucket; stored image keys need no rewrite                                                                         |
| `bootstrap-host.sh`, `harden-ssh.sh`     | first-time server setup (once, by hand)                                                                                                                              |
| `test/*.test.sh`                         | the compose shape, the Caddy rules against a live Caddy, the crawler role against a live Postgres, the scripts' behaviour against a stubbed `docker`, run in `check` |

There is no Redis: one Medusa process runs the in-memory event bus, cache and
workflow engine. A second Medusa instance would need Redis first.

The catalogue crawler is not on the server. It runs on the owner's Mac
(`src/lib/crawler/worker.ts`, a plain Node process, not a second Medusa), see
[The crawler on the owner's Mac](#the-crawler-on-the-owners-mac). It waits for a crawl
started on the admin's Suppliers screen (a number next to the button makes it a
test run that stops after that many stored pages, picked at random across the
whole sitemap), reads the site's sitemap, and fetches one page at a time, at
least 2 seconds apart (more if robots.txt
asks, and Retry-After is waited out). Postgres keeps the queue (`crawl_run`,
`crawl_page`, with the object key in `crawl_page.body_key` and the page's first
sitemap image title in `crawl_page.category_hint`); the gzipped HTML goes
to the private S3 bucket. The import hands that title to the site's parser:
bilstein files each article under it, the supplier's generic article name
(`rame` for «rame sa ležištem, zglobom...»), because its article pages name no
category; the other sites ignore it. A page the site's own parser reads as out of scope
(a MANN+HUMMEL spare part, a febi page outside the families we sell, a VARTA
placeholder) is marked `out_of_scope` with no copy in S3 and is fetched again
only once its last fetch is 30 days old. Requests go through Crawlee with browser-like headers and rotating
sessions; a site marked `fetchMode: 'browser'` (FILTRON, behind Cloudflare) loads
its pages in Playwright's own headless Chromium, while robots.txt and sitemaps
stay plain HTTP. A page the site keeps blocking after Crawlee's retries is marked
failed with its reason in the admin; five such pages in a row pause the crawl, as do
an unreachable robots.txt or sitemap, five server errors in a row and five
crashes of the worker in a row. Pressing the
button again resumes. It crawls one site at a time: a crawl started while another
runs waits as queued, and starts once the running one is done or paused; staff
can pause the running one on its Pause button to let a queued one go first.
Postgres is the queue, S3 holds the pages, Crawlee keeps nothing on disk, so a
stopped worker picks up where it stopped. The worker stamps `crawl_run.heartbeat_at`
every 5 s; while a crawl is queued or running and no stamp is newer than a minute,
the Suppliers screen says the crawler is not running. The import still runs on the
server, from the Supplier's Import button, over what the crawler stored.

### The crawler on the owner's Mac

Once, in `apps/auto-service-shop`:

```bash
pnpm exec playwright install chromium
cp .env.crawler.example .env.crawler
```

`.env.crawler` is gitignored and holds only what the worker reads
(`CRAWLER_ENV_NAMES` in `src/lib/env.ts`): `NODE_ENV=production`,
`DATABASE_URL=postgres://crawler:<CRAWLER_DB_PASSWORD>@127.0.0.1:15432/carlab`,
`DATABASE_SSL=false`, `CRAWLER_FROM`, the same `S3_ENDPOINT`, `S3_REGION` and
bucket names as `/srv/carlab/.env`, and the crawler's own IAM key in
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (see [Files on S3](#files-on-s3)). Copy
the values across without printing them. The Mac never holds `POSTGRES_PASSWORD`
or the shop's S3 key, so a stolen laptop reaches the crawl queue and the crawled
pages, not the catalogue, the orders or the staff accounts.

The `crawler` role is made by `crawler-role.sh`, which `deploy.sh` runs after
every migration and `restore.sh` after a restore, from `CRAWLER_DB_PASSWORD` in
`/srv/carlab/.env` (`openssl rand -hex 32`; anything but hex is refused). It can
log in and `select`, `insert` and `update` `crawl_run` and `crawl_page`, and
nothing else: no other table, no delete, no DDL. A changed password applies at the
next deploy. Unset, the step says so and the crawler has no role. Checked against
a live Postgres by `infra/auto-service-shop/test/crawler-role.test.sh`. `restore.sh`
restores with `--no-privileges`, so a dump never needs the role to exist first.

Postgres runs tuned for the 4 GB droplet: `jit=off`, `work_mem=16MB`,
`shared_buffers=256MB`, `effective_cache_size=640MB`,
`autovacuum_vacuum_scale_factor=0.02`, `autovacuum_analyze_scale_factor=0.02`,
`random_page_cost=1.1` (SSD), `shared_preload_libraries=pg_stat_statements` and
`log_min_duration_statement=1000` (statements over one second reach the logs).
They are `-c` flags on the `postgres`
service in `docker-compose.yml`, asserted by `test/compose.test.sh`. Changing a
flag recreates the container, so a deploy that ships one restarts Postgres, and
that is accepted. `deploy.sh` runs `create extension if not exists
pg_stat_statements` in `carlab` right after Postgres is up, so it is safe to
repeat. The slowest statements by total time:

```bash
docker compose exec -T postgres psql -U carlab -d carlab -c \
  "select calls, round(total_exec_time) ms, round(mean_exec_time) mean_ms, left(query, 80) from pg_stat_statements order by total_exec_time desc limit 10"
```

`select pg_stat_statements_reset()` clears the counters.

Postgres has no host port and sits on the internal `data` network at a fixed
address, `10.200.0.10` (`ipv4_address` in `docker-compose.yml`, subnet
`10.200.0.0/24`), so the worker reaches it through an SSH tunnel as the `crawler`
user. `harden-ssh.sh` creates that user with no shell and an sshd
`Match User crawler` block: local forwarding to `10.200.0.10:5432` and nothing
else, no TTY, no command, no remote listening. Everyone else, `deploy` and CI's
key included, keeps `AllowTcpForwarding no`. Checked by
`infra/auto-service-shop/test/harden-ssh.test.sh`.

Once, on the Mac, make a key for the tunnel and copy its public half, with the
script, to the shop server. The private key never leaves the Mac:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/carlab-crawler -C carlab-crawler
scp infra/auto-service-shop/harden-ssh.sh ~/.ssh/carlab-crawler.pub deploy@<IPv4>:/tmp/
```

Then, from a `deploy` session on the server, rerun the hardening with that file
(through `sudo`, as on the first setup). It installs the crawler's key, writes
the same sshd config as before plus the `Match` block, and is safe to rerun;
without the argument it keeps the key already there:

```bash
sudo sh /tmp/harden-ssh.sh /tmp/carlab-crawler.pub
```

Open the tunnel and leave it open:

```bash
ssh -i ~/.ssh/carlab-crawler -N -L 15432:10.200.0.10:5432 crawler@<IPv4>
```

The address survives a recreate of the postgres container, so the same command
works after a deploy or a reboot; only a dropped connection needs it rerun. The
first deploy that brings the fixed address recreates the `data` network, and
postgres, typesense and medusa restart with it once. In a second terminal, start
the worker and keep the Mac awake while it runs:

```bash
caffeinate -i pnpm --filter @podbor/auto-service-shop crawler
```

It builds the workspace packages it needs, then waits for a crawl queued in the
admin. Stop it with Ctrl+C once the crawl is done, then close the tunnel. A crawl
stopped mid-way (Ctrl+C, a sleeping Mac, a dropped tunnel) stays `running` and
resumes from where it stopped the next time the worker starts; a page it held
is retried once its 10 minute lease runs out.

`pnpm --filter @podbor/auto-service-shop crawler:status` prints each site's run
status, its pause reason and its page counts. A run paused by the worker (the
worker logs `Crawl of <site> paused: <reason>`) waits for a new crawl queued in
the admin.

### Admin runs from a terminal

`pnpm --filter @podbor/auto-service-shop admin publish|import <supplier_id>|status [<supplier_id>]`
starts a Publish or an Import, or prints the latest run, as one JSON line;
`--wait` polls once a minute until the run leaves `running` and exits 1 when it
failed. It signs in with a Medusa secret API key, not a session, so a shop
restart does not log it out. Create the key in the admin (Settings → Secret API
Keys) and put it with the admin URL in `apps/auto-service-shop/.env.admin`
(see `.env.admin.example`).

### The server

- `/srv/carlab/`: CI places `docker-compose.yml`, `caddy/Caddyfile`, the Loki,
  Alloy and Grafana configs (`loki/`, `alloy/`, `grafana/`) and the scripts
  there on every deploy; `.env` (mode 600) is written by hand once;
  `.previous-tag` holds the previously shipped sha, for rollback. After a successful
  ship, `deploy.sh` deletes shop and Caddy images other than the current one and
  `.previous-tag` (a failed deletion does not fail the deploy), otherwise every ship
  leaves a few hundred MB on the disk.
- `/var/backups/carlab/`: backups. The cron `/etc/cron.d/carlab-backup` runs
  `backup.sh` at 03:30 UTC, logging to `/var/log/carlab-backup.log`; each night adds
  one `pg_dump` of the database, kept for 7 days. That is the database only:
  uploaded and crawled images live on S3 and are protected there by versioning
  (see [Files on S3](#files-on-s3)). `deploy.sh` adds a `*-pre-deploy.dump` per
  ship and keeps the last three of them, whatever their age. If a deploy or a backup is killed mid-run (a reboot, a `kill -9`),
  `.deploy.lock` is left behind and blocks both: once you have confirmed that
  neither `deploy.sh` nor `backup.sh` is running (`pgrep -f "deploy.sh|backup.sh"`),
  remove it with `rmdir /srv/carlab/.deploy.lock`. This is a copy on the same disk;
  off the server there are the dumps in the backup bucket (see
  [Backup and restore](#backup-and-restore)). The Droplet's paid backups are
  off to save cost: a lost instance is rebuilt with Terraform, `bootstrap-host.sh`
  and `restore.sh`.
- **Typesense is not backed up.** Its index is derived from Postgres and rebuilt
  by the nightly `reindex-search` job (ADR-0041), so after a restore search stays
  empty until the next 04:00 Belgrade rebuild.
  A rebuild reindexes in batches of 1000 (`reindex.batch_size` in
  `medusa-config.ts`) and the Typesense client waits 60 s for a connection.
  After the deploy that ships this, run a full rebuild once and write its
  docs/s (documents indexed divided by the job's wall time in `docker compose
logs medusa`) here. TODO: record the measured docs/s.
- Only Caddy is published outward: 80, 443, 443/udp. Grafana listens on
  `127.0.0.1:3000` only, for an SSH tunnel. Medusa, Postgres, Typesense, Loki
  and Alloy have no host ports; Postgres and Typesense sit on an internal network with no
  route to the internet, and the storefront reaches search only through Medusa's
  store routes. Checked by `infra/auto-service-shop/test/compose.test.sh`.
- IPv6 reaches Caddy directly: the `edge` network is dual-stack (`enable_ipv6`, ULA
  `fd00:ca7:1ab::/64`) and `userland-proxy` is disabled in `daemon.json`. Never turn
  the userland proxy back on, or every IPv6 client becomes the docker gateway's
  address.
- Memory limits for 4 GB: medusa 1120m (an 800 MB Node heap), typesense 640m
  (room for the two collections of the nightly swap reindex),
  postgres 1024m, caddy 160m (with the page cache, below), the three sites 160m each (a 112 MB Node heap),
  loki 192m, alloy 160m: 3776 MB for what always runs, under 3.75 GB, and
  grafana's 256m on demand only, 4032 MB with it, under the 4 GB of the host
  (both checked by the compose test), with the 2 GB swap `bootstrap-host.sh`
  makes behind it. Grafana sits behind the `grafana` profile: start it for a
  look with `docker compose --profile grafana up -d grafana` and stop it after.
  Measured idle in `infra/auto-service-shop/test/logs.test.sh`: grafana about
  200 MB, loki and alloy about 100 MB each. If the box swaps, the logs go
  first: stop them with `docker compose stop grafana alloy loki`, the shop
  runs without them.
- The three Astro sites run from `/srv/sites/<app>/running` and Caddy serves
  their files from `/srv/sites/<app>/current`, both links to
  `releases/<name>`, one `site-<app>` container each, started only once a
  release is live (`deploy.sh` turns on the `site-<app>` profile of every
  directory under `/srv/sites` with a `current` link, and gives a site released
  before `running` existed its link). `deploy-site.sh <app> <name>` points
  `running` at the release, recreates the container, waits for it to answer
  `/`, and only then points `current` at it; on failure it points `running`
  back and leaves `current` alone. It keeps the live release and the one before it. Caddy serves a release's files itself
  (`/_astro/*` for a year, everything else revalidated) and hands every other
  path to node, except `/_image`, which answers 404 (no sharp at runtime).
  Every redirect comes from node: each site's 404 is on demand, so middleware
  runs for every path Caddy hands over. Caddy adds only the security headers,
  from `caddy/security-headers.caddy` (shared by the three sites;
  `.github/scripts/security-headers-drift.sh` fails `check` when it drifts).
  Proxied requests keep the apex `Host`, carry `X-Forwarded-Proto: https` and an
  `X-Request-Id`, and `X-Forwarded-For` is Caddy's own view of the client. The `carlab-reminders`
  systemd timer runs `reminders.sh` at 08:00 UTC, which calls carlab.rs's
  `/api/reminders` inside its container with the container's own `CRON_SECRET`. The crawler runs on the owner's Mac, so it is not in the budget.
  Typesense holds its whole index in memory; measure it with
  `docker stats --no-stream` once the catalogue is at scale, and raise the limit
  before the index outgrows it.
- **carlab.rs catalogue page cache** (ADR-0065). Caddy caches what node
  renders for `/<locale>/parts/...`, `/<locale>/cars/...`, `/llms.txt`,
  `/<locale>/llms.txt`, `/catalogue-build.json` and the catalogue sitemap
  (`/sitemap-catalogue.xml` and its `/sitemap-catalogue-<n>.xml` chunks), on
  GET and HEAD only (the `@catalogue` matcher in the Caddyfile). `search`,
  `cart` and `prices` are not cached, nor the `/<locale>/parts/` hub when the
  request carries a query string (its showcase pages through `?offset=` and
  filters, which the key would drop), and neither are the other paths or the
  other two sites. The response's
  `Cache-Control` decides what is stored. Without one, nothing is stored
  (`default_cache_control no-store`). `private` and `no-store` are never
  stored. A request's own `Cache-Control` or `Pragma` cannot force a render
  (`mode bypass_request`). The key is the method, host and path. The query
  string is not part of it, so `?utm_source=x` gets the bare path's entry. A
  request whose `auto_service_shop_preview` cookie holds exactly
  `SHOP_PREVIEW_TOKEN` skips the cache (Caddy reads the token from the same
  `.env`, so changing it needs `docker compose up -d caddy`); a junk or empty
  value stays on the cache, and with no token set nothing bypasses. The
  `auto_service_shop_preview_on` flag cookie alone does not.
  - **Image.** `infra/auto-service-shop/caddy-tag.sh` derives the tag: the
    first 40 hex characters of a sha256 over `caddy-image/Dockerfile`,
    `caddy/Caddyfile` and `caddy/security-headers.caddy`, so it changes only
    when Caddy itself changes. `shop-image` in CI builds `caddy-image/Dockerfile`
    for amd64 and pushes `ghcr.io/zikrasoft/podbor-carlab-caddy:<tag>` only when
    that tag is not in the registry yet. `deploy-shop` writes the tag to a
    `caddy-tag` file shipped with the stack files; `deploy.sh` reads it, pulls
    that image with the shop image and records `CADDY_TAG` in `.env`.
    `docker-compose.yml` names the image by `CADDY_TAG`, which defaults to
    `MEDUSA_TAG`: a host with no `caddy-tag` file (a rollback to a sha shipped
    before this) drops `CADDY_TAG` and falls back to the shop tag. A shop
    deploy that does not touch Caddy leaves its tag, so compose does not
    recreate the container and the page cache survives. The host never
    compiles Caddy. A sha shipped before this image existed has no Caddy
    image: a rollback to it fails at the pull and changes nothing.
  - **Storage.** Souin `simplefs` keeps the bodies, lz4-compressed, in the
    `caddycache` volume at `/cache`. The index stays in Caddy's memory, so a
    restart or a reload with a changed Caddyfile empties the cache: every
    shop deploy that changes Caddy starts it cold, any other keeps it (ADR-0065). The image
    command empties `/cache` before Caddy starts, so a restart leaves no
    orphaned files and the disk stays bounded by the entries of one run.
  - **Cap: 40,000 index entries.** A page takes three entries, so the cache
    holds about 13,300 pages. Once it is full, the least recently used page
    goes first. On disk, 30 random catalogue pages from the live sitemap
    averaged 118 KB raw and 29 KB stored, so a full cache holds about 390 MB.
  - **Surrogate keys are off** (`disable_surrogate_key`). With them on, Souin
    kept one entry listing every URL it had stored and rewrote it on every
    store, so memory grew with each new page: Caddy was OOM-killed after
    about 80,000 new pages at 128 MB and 120,000 at 256 MB, while the live
    sitemap lists 99,663 catalogue URLs. Nothing purges by surrogate key.
    `test/compose.test.sh` checks the list stays empty.
  - **Memory, measured on 2026-11-24.** This image under its 128 MB, a stub
    node serving a real 85 KB catalogue page with `public, s-maxage=86400`,
    eight requests in parallel, sampled every 10,000 requests from the
    cgroup (`anon` in `memory.stat`) and `/proc/1/status`. Caddy sets its Go
    memory limit to 90% of the container's, so it collects harder as it
    nears the limit rather than failing, and anonymous memory rises with the
    limit. What sets 128 MB is the 96 MB run: it peaked at 69 MiB, 54% of
    128 MB, the headroom #488 kept (71 of 128 MiB, 55%).

    | Load                                         | Limit  | Anonymous memory | Result   |
    | -------------------------------------------- | ------ | ---------------- | -------- |
    | 100,000 new pages, past the cap 86,700 times | 128 MB | 78 to 101 MiB    | survived |
    | 13,000 pages, then 3 more rounds of hits     | 128 MB | 32 to 88 MiB     | survived |
    | 13,000 pages, `s-maxage=2`, 4 rounds         | 128 MB | 68 to 93 MiB     | survived |
    | 100,000 new pages                            | 96 MB  | 46 to 69 MiB     | survived |

    Raise the cap only after measuring the memory again.

  - **Other storages tried.** Badger v0.0.20, with surrogate keys off,
    `stale 24h` and 8 MB memtables and caches, served a stale page with node
    stopped past `s-maxage`, kept its pages across a restart, and its disk
    followed the live pages (2.1 GB for 100,000). But
    eight parallel requests over 13,000 cached pages got it OOM-killed at
    176 MB, sequential new pages at 128 MB, and it needed 256 MB (anonymous
    memory up to 173 MiB), which does not fit beside Medusa's 1120 MB.
    Nuts and Otter were tried only with surrogate keys still on: Nuts wrote
    1 GB to disk within a few thousand pages, and Otter, which keeps the
    bodies in memory, was OOM-killed at 256 MB before 40,000 pages.
  - **Stale copies.** While node is down, a page still within its
    `s-maxage` is served from the cache as a hit. `simplefs` v0.0.20 drops a
    body when its `s-maxage` runs out, so the page header sends neither
    `stale-while-revalidate` nor `stale-if-error`. An expired or never-cached
    page then gets what node gives, a 502 if node is down.
  - **404.** A catalogue 404 carries `public, s-maxage=600`, not the day-long
    page header, so a Part published after a visit opens within 10 minutes.
  - **Purge.** `deploy-site.sh auto-service <release>` empties the whole
    cache right after `current` points at the new release:
    `docker compose exec -T caddy curl -fsS -X PURGE http://127.0.0.1:2019/souin-api/souin/flush`.
    Every Publish and every code release goes through it. The Souin API sits
    on Caddy's admin endpoint, which listens on the container's loopback and
    has no published port. The public hosts hand `/souin-api/...` to node like
    any other path. If the purge fails, the deploy fails and the healthy
    release stays live. Run the same command by hand to empty the cache.
  - **Publish purge.** The shop purges only what a Publish changed, through
    an internal Caddy listener, `http://:2020` in the Caddyfile. It sits on
    the compose network alone, with no entry in `ports`, and the shop reaches
    it as `CACHE_PURGE_URL=http://caddy:2020/souin-api/souin` (set in compose;
    the shop refuses to start in production without it, and elsewhere the
    `purge` step sends nothing while it is unset). It forwards to the Souin
    API only a `PURGE` under `/souin-api/souin/`, whose rest of the path is a
    regex over the cache keys (`GET-https-carlab.rs-/ru/parts/c/brakes/`) and
    holds at least three letters or digits in a row; it answers 403 to
    `flush`, `mapping`, a catch-all such as an empty pattern, `.+`, `.*` or
    `-/.*`, every other path and every other method. That check only stops a
    slip; the boundary is the compose network itself: anything on it can still
    purge a broad pattern such as `carlab`, so nothing untrusted runs on it. The
    pattern travels in the path unescaped, so it holds no `|`, `^`, `{`, `?`
    or `\`: Go escapes them on the proxy hop and Souin then matches the
    escape literally. That is why the hubs take several patterns, not one
    alternation: `-/[a-z][a-z]/cars/`, `-/[a-z][a-z]/parts/$` (the `/parts/`
    hub), `-/[a-z][a-z]/parts/[0-9a-oq-z]` and `-/[a-z][a-z]/parts/p[0-9a-z-]`
    (every `/parts/` page but `/parts/p/`), `llms[.]txt`, `sitemap` and
    `catalogue-build[.]json`. Each Part page whose number is fresh, flipped
    `listed` or was swept gets `-/[a-z][a-z]/parts/p/<slug>/`, which covers
    the three locales at once; a slug character outside `a-z`, `0-9` and `-`
    becomes `.`, so a slug never smuggles regex into the pattern. The patterns live in
    `apps/auto-service-shop/src/lib/publish/purge.ts`. `simplefs` before
    v0.0.23 deleted only the first key a regex matched, because it deleted
    while ranging over the cache; the image pins v0.0.23, which collects the
    keys first.
  - **Prewarm.** Right after the purge the Publish chain's last step,
    `prewarm`, starts `warmCataloguePages`
    (`apps/auto-service-shop/src/lib/publish/prewarm.ts`) in the background:
    it GETs through `STOREFRONT_ORIGIN` (the public origin, so every answer
    lands in the Caddy cache), two at a time with 30 s per URL, errors counted
    and swallowed. The set is the `/parts/` hub, `/parts/makes/`, every
    `/parts/<make>/` with a hub, every `/parts/c/<category>/` and `llms.txt` in
    each of `ru`, `sr` and `en`, then `/llms.txt`, `/catalogue-build.json`,
    the catalogue sitemap index and its chunks, and the `/<locale>/cars/<make>/`
    pages the site's own `/<locale>/cars/` listing links (the shop cannot know
    the workshop makes). Series and Part pages are left cold: they are cheap
    and about 176,000 of them would push the hubs out of the cache. It runs in
    the background because the run holds the catalogue writer lock, and a
    cold hub can take 30 s: waiting would block the next Publish for
    minutes. Its result is the `catalogue.prewarm` log event (warmed and
    failed counts), not a run failure. It is a no-op while `STOREFRONT_ORIGIN`
    is unset (production sets it in the shop `.env`, see
    `production.env.example`). `deploy.sh` (after the health check) and
    `deploy-site.sh` (after the flush, carlab.rs only) start the same warm-up
    detached in the running `medusa` container with
    `medusa exec ./src/scripts/warm-pages.js`; a failure to start it only
    prints a warning.
  - **Checking a hit.** `curl -sI https://carlab.rs/ru/parts/makes/ | grep -i cache-status`.
    `Souin; hit; ttl=...` came from the cache. `Souin; fwd=uri-miss; stored`
    went to node and was stored. `detail=NO-STORE-DIRECTIVE` went to node and
    was not stored. No `Cache-Status` at all means the request did not go
    through the cache.
  - `test/compose.test.sh` builds the image and checks all of this against a
    live Caddy in front of a stub node: hit, miss after the purge, the query,
    the preview cookie, `private, no-store`, the paths and sites left out, a
    purge from the public host, and a hit while node is stopped.

### Files on S3

The shop keeps no files on the server: everything is on AWS S3, in two buckets of
its own (not the backup bucket).

- **Public bucket** (`S3_PUBLIC_BUCKET`): Brand-number and Category photos, through
  Medusa's File module with the `@medusajs/medusa/file-s3` provider, and the images
  found by the crawler. The admin posts the original (JPEG, PNG or WebP, up to
  10 MB, checked by decoding it, not by its name); the backend writes 160, 480 and
  960 px WebP copies and stores their URLs on the PartIdentifier or Category. A
  Supplier import copies each crawled image once into `supplier-images/<sha256 of
the file>`, with the source URL in the object's `source-url` metadata, and a
  pointer `supplier-images/by-source/<sha256 of the source URL>` holding that key.
  It stages every image of the page in the page's order, one copy of identical
  files, each with its source URL beside it in the staged record; a later import
  finds the pointer and downloads nothing. Only http(s) on a public address
  is fetched (a host resolving to a private, loopback or link-local range is
  refused), and a download stops at 10 MB. An image that cannot be fetched is
  staged nowhere, so the site never links the brand's server, and is tried again
  on the next import.
- **Private bucket** (`S3_PRIVATE_BUCKET`): the crawler's raw pages, gzipped, under
  `crawl/<supplier key>/<sha256 of the URL>.html.gz`, such as `crawl/mann-filter/…`. The import reads them back from there.

Bucket setup: keep Object Ownership on "Bucket owner enforced" (ACLs off; the file
provider runs with `acl: false`), and make the public bucket readable with a
bucket policy granting `s3:GetObject` on `arn:aws:s3:::<public bucket>/*` to
everyone; the private bucket stays fully blocked. The Droplet is outside AWS and has no instance role
for S3, so the shop gets an IAM user of its own with `s3:PutObject`,
`s3:GetObject`, `s3:DeleteObject` and `s3:ListBucket` on those two buckets only.
The nightly backup covers Postgres only, so the public bucket is versioned: an
overwritten or deleted image stays recoverable as a noncurrent version for 30
days, then expires so old versions stop costing. Set it once, with an
administrator's AWS credentials (the shop's IAM user cannot change bucket
settings):

```bash
aws s3api put-bucket-versioning --bucket <public bucket> \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket <public bucket> \
  --lifecycle-configuration '{"Rules":[{"ID":"expire-noncurrent","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":30},"Expiration":{"ExpiredObjectDeleteMarker":true},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'
aws s3api get-bucket-versioning --bucket <public bucket>
aws s3api get-bucket-lifecycle-configuration --bucket <public bucket>
```

A lost image comes back with `aws s3api list-object-versions --bucket <public
bucket> --prefix <key>` and a `copy-object` of the wanted `VersionId` onto the
same key. The private bucket is not versioned: its raw pages are re-fetched by
the next crawl.

The crawler on the owner's Mac gets a second IAM user, with the private bucket
only, so a key lifted off the Mac cannot touch the public images:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::<private bucket>/crawl/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<private bucket>",
      "Condition": { "StringLike": { "s3:prefix": "crawl/*" } }
    }
  ]
}
```

Its `.env.crawler` still names `S3_PUBLIC_BUCKET` because the shared env schema
requires it, but the worker never writes there and the policy would refuse it.

Moving an existing server off the old `static` volume, once, after the first
deploy with the S3 settings: `/srv/carlab/move-static-to-s3.sh` copies the volume
into the public bucket with `aws s3 sync` (in a pinned `amazon/aws-cli` container,
keys through a temporary env file). The database needs no rewrite:
`part_identifier.images` and `category.image` store object keys, never a host, and
the keys stay the file names. Then `docker volume rm carlab_static` once the
images show.

### `.env`

The template is `infra/auto-service-shop/production.env.example`, and `src/lib/env.ts`
validates everything at startup. CI boots the image on the same template
(`.github/scripts/shop-ci-env.sh` fills every empty value with a placeholder and
swaps in the test stack), and `env.spec.ts` fails when the filled template does
not pass production validation. A new variable whose value must be a URL or a
number gets its CI value in that script. The non-obvious parts:

- do not touch `MEDUSA_TAG` by hand: `deploy.sh` rewrites it.
- `POSTGRES_PASSWORD`, `TYPESENSE_API_KEY`, `JWT_SECRET`, `COOKIE_SECRET`:
  `openssl rand -hex 32`. Hex specifically: compose substitutes `$…` inside `.env`.
  With `NODE_ENV=production` the shop refuses to start on a `JWT_SECRET` or
  `COOKIE_SECRET` shorter than 32 characters.
- `DATABASE_URL` and the `TYPESENSE_HOST`/`PORT`/`PROTOCOL` are not written into
  `.env`: compose assembles them from the service names, `POSTGRES_PASSWORD` and
  `TYPESENSE_API_KEY`, and hands the same key to Typesense itself.
- `OPENAI_API_KEY` feeds the admin's Publish chain, which translates catalogue
  text with it. A Publish is data-only: it never dispatches a GitHub workflow,
  rebuilds the site or opens SSH, and the host holds no GitHub token. The chain is
  `shrink → sweep → translate → publish → reindex → purge`. `shrink` writes
  nothing: it counts the Part pages the published numbers name now (numbers
  whose identifier was deleted since still count, the sweep has not removed
  them yet) and the Part pages the live identifiers would give once swept and
  published, and refuses the Publish when the second is under half the first,
  so the run fails at `shrink` with the catalogue untouched, again on every
  retry, until `CATALOGUE_SHRINK_ALLOWED=true` sits in the shop's
  `.env` for one Publish; remove it afterwards. `publish` collects the
  change set: the freshly published numbers, the numbers whose `listed`
  flipped, the Parts whose translations `translate` wrote and the numbers the
  orphan `sweep` removed. Then it warms the shop's
  catalogue memo (the page list, counts and demand), so the renders after the
  purge read it ready. `reindex` is incremental: only
  the changed Parts go to `part_identifier` (the removed numbers are deleted
  from it), and `catalogue_car` is rebuilt with a swap; when `part_identifier`
  has no active version, it gets a full swap instead. Then a count check
  compares the `published:true` documents with the published numbers for up to
  a minute and logs a `search.drift` Event when they still disagree, without
  failing the Publish. Search is updated before the purge, so the first renders
  after it already find the new Parts. `purge` then empties the catalogue hubs
  and the changed Part pages from the page cache (see the Publish purge above).
  The hubs include everything on carlab.rs that lists the catalogue and renders
  on demand: the catalogue sitemap, both `llms.txt`, the `/parts/` hub and
  `catalogue-build.json`, so the purge is all a Publish needs for them to show
  the new state. A failed run keeps what it published and writes its change
  set, with whatever it carried, into its report as `unfinished`; the next
  Publish starts from the `unfinished` of the latest run that wrote a report,
  so a retry after a failed `reindex` or `purge` reindexes and purges the
  earlier run's Parts and pages as well as its own. A run the restart
  interrupted writes no report, so the Publish before it is the one carried.
  Without
  `OPENAI_API_KEY` the chain stops at `translate` once any text is untranslated,
  and the admin shows why. The chain runs only from the admin's Publish button,
  in the top bar of every admin page. The services and works pages stay
  prerendered and read the Category links at build, so they pick up a new
  Category on the next code release, not on a Publish.
- `OPENAI_API_KEY` also answers a Supplier Import's one question per new
  article (Russian name, attributes, description; the Category comes from the
  supplier category mapping, never from AI), on
  `gpt-6-luna`, the one model the shop asks. Answers are cached in the
  private bucket under `ai-answers/`, keyed by prompt, model and article, so a
  rerun or a rebuilt database asks nothing twice; changing the model or the
  prompt asks again. The prompt carries only the article's own Category, so
  editing another Category asks nothing again. A re-import refreshes the
  attributes of a Part it filed, unless staff edited them, and re-files a Part
  whose supplier category now maps to another Category, with attributes read
  afresh for it, unless staff set the Part's Category; a code mapped to no
  Category leaves its Parts where they are. `IMPORT_AI_LIMIT` (empty means no
  limit) stops each Supplier's Import after that many AI answers and keeps the
  offers and flags of the articles it did not reach, for a costed trial run:
  the report counts `ai_answers`, `ai_input_tokens` and `ai_output_tokens`. An answer that fails validation twice is cached as a
  failure too and listed in the Import report, so a rerun does not pay for it
  again. Without S3 nothing is cached. `IMPORT_CONCURRENCY` (empty means 4) is
  how many articles are asked at once; vehicle fitting still runs one article
  at a time. `LIVE_QUOTE_CACHE_SECONDS` (empty means 60, 0 turns it off) is how
  long a part's offer view reuses a supplier's live quote; the cart and checkout
  always quote afresh. `STORE_WRITES_PER_MINUTE` (empty means 120) and
  `STORE_SEARCHES_PER_MINUTE` (empty means 600) are the per-client limits on
  store cart/VIN writes and on search. Storefront traffic arrives from the
  carlab.rs server, one address for every visitor, so carlab.rs names the visitor behind each call: its
  server-side catalogue sends the visitor's address (`x-real-ip`, else the
  first `x-forwarded-for` hop) as `x-shop-client` beside
  `x-shop-client-secret: $SHOP_CLIENT_SECRET`, and the shop counts that visitor
  only when the secret matches `SHOP_CLIENT_SECRET` or
  `SHOP_CLIENT_SECRET_PREVIOUS` (or, for one release, `SHOP_LEAD_SECRET`). An
  IPv6 visitor is counted by its /64, so rotating addresses inside one
  subscriber network shares one bucket.
  Without the secret on both sides every shopper shares one bucket again. An answer's attributes that do not fit its Category are dropped one
  by one; a Part whose answer still misses a required field stays without a
  Category, and the report names the Category and the missing fields.
- The admin host has no basic_auth: Medusa's own sign-in is the only gate, and
  Medusa does not limit sign-in attempts, so every staff account gets a long
  random password. The API host answers 404 on `/admin` and `/auth/user`, so
  staff routes exist only on the admin host; the storefront calls only
  `/store/*` (and the `/health/ready` probe). Checked against a live Caddy by
  `infra/auto-service-shop/test/compose.test.sh`.
- `CRAWLER_DB_PASSWORD` is the crawler's Postgres password, see
  [The crawler on the owner's Mac](#the-crawler-on-the-owners-mac).
  There is no nightly run: cart and checkout quote price and stock live, and a
  build bakes the prices current at that moment into the pages' structured data.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_ID` are the CRM bot's own values: when an order's Lead still has not reached the storefront after the last retry, the shop posts an alert to that group. Empty, the failure only reaches the log.
- `ADMIN_HOST` is where staff open the admin (`admin.carlab.rs`): Caddy proxies it to the same Medusa, sends `/` to `/app`, and redirects `api.carlab.rs/app` there. `ADMIN_CORS` and `AUTH_CORS` name that origin; the admin calls the API on its own origin, so `admin.backendUrl` stays unset.
- `STOREFRONT_ORIGIN` is the storefront's bare origin (`https://carlab.rs`, no
  path; the shop refuses to start on one with a path): the `order.placed`
  subscriber posts a placed order to `/api/shop-orders` on it as a
  `parts-order` Lead, which reaches Telegram like every other Lead, and the
  admin's order screen links there. Any non-2xx answer, a 404
  included, is a failed handoff that the retry job sends again. Empty, orders
  are placed but reach nobody, and the log says so. **A new
  `shopOrderEventSchema` event reaches carlab.rs before the shop sends it**:
  the event joins `@podbor/lead-crm/shop-orders-wire`, carlab.rs deploys with
  `/api/shop-orders` reading it, and only then does a shop release send it. A
  storefront that cannot parse an event refuses it, and the shop retries it
  until it gives up and alerts the group. A delivered order is stamped
  `lead_handed_off_at`; every 10 minutes `src/jobs/retry-order-leads.ts`
  re-sends each order from the last two days (older than two minutes) that
  lacks the stamp, six attempts in all, timeouts included. That also catches
  an `order.placed` event lost to a restart, since the event bus lives in
  memory. A re-send cannot make a second Lead: the post carries `order_id`, and
  the lead store answers a known order with the Lead it already made. The last
  failed attempt is reported to the CRM group through `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_GROUP_ID`, the same names and values as the sites' CRM bot.
  Both are optional; unset, the failure is only logged.
- `VIN_DECODERS` is the VIN decoder chain, comma-separated, in the order they
  are tried. An unknown name stops the server at startup. Each decoder works
  offline, from the VIN and data committed under
  `apps/auto-service-shop/src/lib/vin`:
  - `bmw-type-code`: BMW (WMI `WBA`, `WBS`, `WBX`, `WBY`, `5UX`), the type
    code in characters 4 to 7, matched through the BimmerArchive type-key
    table `bimmerarchive-type-keys.json` (ADR-0051).
  - `mercedes-baumuster`: Mercedes-Benz, the Baumuster in characters 4 to 9,
    matched to crawled Model names that list it (ADR-0050).
  - `vag-model-code`: Volkswagen, Audi, Skoda, SEAT and Cupra, the model code
    in characters 7 and 8, read through `vag-model-code-rows.json`. Each row names
    the generation, its type designations, its years and the public sources
    it comes from (Wikibooks, Wikipedia, manufacturer documents, public VIN
    records). A VIN matches the crawled Vehicles of its make whose Chassis
    code starts with one of those types and whose years hold the model year
    in character 10.
  - `wmi-make`: every other make, from the WMI alone, last in the chain. It
    names the make so the lookup is saved and the visitor reaches the make's
    page; it matches no Vehicle.

  A code a decoder reads but cannot match lands on the admin Unresolved VINs
  screen with what the open data says about it, and with where each lookup
  came from: the carlab.rs search, a Workshop quote, or another admin path.
  By default the screen lists only codes a real customer searched: a carlab.rs
  lookup whose visitor carlab.rs did not take for a bot by its user agent and
  whose visitor id is not in `STAFF_VISITOR_IDS`.

- `STAFF_VISITOR_IDS` is the comma-separated list of our own carlab.rs visitor
  ids (the `visitor_id` key in the browser's localStorage, or the `visitor_id`
  cookie, on carlab.rs, a UUID),
  not the GA4/Metrika client ids of `analytics-exclusions.md`. Optional; an
  entry that is not a UUID stops the server at startup. Read when the
  Unresolved VINs screen loads, so a change reclassifies past lookups too.
  The screen shows the first eight characters of each customer visitor id per
  code, to find the Lead whose «ID посетителя» starts with them.

- `TYPESENSE_API_KEY` has a local default only outside production; with
  `NODE_ENV=production` an empty one stops the server at startup.
- `FILE_URL` is the public base URL of shop images, `https://media.carlab.rs`.
  The database stores object keys only and the shop puts `FILE_URL` in front of
  them when it answers, so the host can change without rewriting a stored row.
  Without it production stops at startup.
- `MEDIA_ORIGIN` is where Caddy fetches `media.carlab.rs` from, the public
  bucket's endpoint (`https://<bucket>.s3.<region>.amazonaws.com`). Caddy
  answers GET and HEAD only and marks every image cacheable for a year: image
  keys never change content (supplier images are named by their sha256). A CDN
  in front later (Bunny pulling from this origin, or CloudFront once AWS verifies
  the account) is a DNS change for `media`, not a data change. `MEDIA_HOST`
  defaults to `media.carlab.rs`.
- `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BUCKET` and
  `S3_PRIVATE_BUCKET` are all required in production, and outside it either all
  set or none (none keeps uploads on the local disk under `/static` and leaves
  crawled images linked to their source; crawling needs the buckets).
  `S3_ENDPOINT` stays empty for AWS itself and names a MinIO or other S3-compatible
  server otherwise (path-style addressing is switched on with it). See
  [Files on S3](#files-on-s3).
- `SUPPLIER_ADAPTERS` names the Supplier adapters the shop reads, comma-separated.
  `mann-filter` is the crawled MANN-FILTER catalogue: its crawl starts from the
  Suppliers screen and its Import button reads what the crawler stored. `varta`
  is the crawled VARTA battery catalogue (the Serbian product pages), run the
  same way. `bilstein` is the crawled bilstein group partsfinder (febi, SWAG,
  Blue Print), Serbian pages of the filter, brake, suspension and service part
  families only, one request per 5 s. `filtron` is the crawled FILTRON
  catalogue (the Serbian product pages, same platform as MANN-FILTER), its pages
  rendered in Chromium by the crawler on the owner's Mac. `demo` never runs in production.
- `CRAWLER_FROM` (in the Mac's `.env.crawler`, not here) is the mailbox the crawler
  sends in its `From` header, so a site owner can reach whoever runs it. Empty, no `From` is sent.
- `SHOP_OPEN` decides whether anyone may buy. Unset, the shop is closed with
  `NODE_ENV=production` and open everywhere else; the template sets `false`.
  See [Closed beta](#closed-beta-the-preview-flag).
- `SENTRY_DSN` turns on error reporting to Sentry. Empty, the SDK is never
  started and nothing leaves the server. See [Monitoring](#monitoring).
- `SHOP_EVENTS_SECRET` (and `SHOP_EVENTS_SECRET_PREVIOUS` while it rotates) is
  the Bearer secret carlab.rs posts its Events with, see
  [Shop Orders](#shop-orders-adr-0053). `STOREFRONT_EVENTS_PER_MINUTE` (empty
  means 1200) caps those posts; they all come from the carlab.rs server, so
  it is one bucket for the whole storefront.
- `GRAFANA_ADMIN_PASSWORD` is Grafana's `admin` password,
  `openssl rand -hex 32`. Required: compose refuses to start the stack without
  it, so set it before the first deploy that carries the logs. Grafana keeps
  the first value in its database, so a change takes, after editing `.env`:
  `docker compose exec grafana grafana cli admin reset-admin-password "$(sed -n 's/^GRAFANA_ADMIN_PASSWORD=//p' .env)"`.
- Never print the file. Read a single value with `sed -n 's/^NAME=//p'` into a
  variable, or list names only: `cut -d= -f1 /srv/carlab/.env`.

### Closed beta: the preview flag

The parts catalogue is public and indexable, but buying is closed until both
sides say otherwise. Two variables, one per side:

| Variable    | Where                                    | Closed (default)                                                                                                                                                                                                                                                                              | `true`                       |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `SHOP_OPEN` | `site-auto-service` variable, build time | pages carry no price, no Offer JSON-LD, no add-on price, no cart link; every part asks «Узнать цену»; search drops prices and the price filter; llms.txt names no cart                                                                                                                        | prices and cart for everyone |
| `SHOP_OPEN` | `/srv/carlab/.env` on the shop VPS       | without the preview token, `POST /store/offer-carts`, `/store/offer-carts/:id/items` and `/store/offer-carts/:id/complete` answer 403, and every store route answers with no offers, no add-on price and no price or stock filter (search ignores `in-stock` and `price` and counts no stock) | anyone may buy               |

On carlab.rs only the exact value `true` opens the shop: unset or anything else
is closed. turbo passes `SHOP_OPEN` and `SHOP_PREVIEW_TOKEN` through to the
`@podbor/auto-service` build, so a deploy is what
applies a change. An open build sends the preview token itself, so it builds
with prices even if the backend is still closed.

The preview is a secret token, `SHOP_PREVIEW_TOKEN`: the same value in the
`site-auto-service` environment (a secret, never `PUBLIC_`) and in
`/srv/carlab/.env`. It is 32 to 256 letters, digits, `_` or `-`; make one with
`openssl rand -hex 32`. Both sides refuse a shorter value at start, and while
it is unset nobody gets the preview, the open build included.

A closed-beta tester opens `https://carlab.rs/api/shop-preview?token=<token>`
once. The route keeps the token in the `httpOnly` `auto_service_shop_preview`
cookie for a year, beside an `auto_service_shop_preview_on=1` flag that page
scripts read (it holds no secret), and sends the tester to the parts index; a
wrong token gets 403 and no cookie, and `/api/shop-preview` with no token
forgets both. A tester whose cookie predates the flag opens the link once more. The token travels in
that one API request only, never in a page address, so analytics never record
it. With the cookie the visitor sees the shop as it will look open: the header
and the parts index show the cart; listings, series pages, kits (with
their «в корзину» button), add-on prices and the price filter on static pages
are filled after load by one `POST /{locale}/parts/prices/` per page, which
renders the same components with prices; a part page fetches its offers live
from `/api/part-offers`; search renders prices and the price filter on the
server; the cart and checkout work. carlab.rs compares the cookie with its own
`SHOP_PREVIEW_TOKEN` (timing-safe) and sends Medusa `x-shop-preview: <token>`,
which Medusa compares with its copy. Without the cookie, `/parts/cart/`
redirects to the inquiry form and nothing above runs.

Anyone holding the token can buy and see prices, so give it only to testers,
and rotate it by changing both copies when someone should lose access (testers
then open the link again). Open the shop by setting `SHOP_OPEN=true` on both
sides, restarting the backend (`deploy.sh` or `docker compose up -d medusa`)
and rebuilding carlab.rs.

**Rolling out the token.** The two sides deploy separately, and a side that
does not know the token yet fails closed: the old shop accepts only `1`, the
new one only the token, so between the two deploys testers see the closed shop
and nobody else sees more. Set `SHOP_PREVIEW_TOKEN` in both places first,
deploy the shop, then redeploy carlab.rs, and send testers the new link. A
shop rollback to an image without the token closes the preview until the shop
moves forward again.

### How it ships

1. `shop-image` builds the image from the SHA after `translate`, migrates an empty
   database on the CI runner (`apps/auto-service-shop/docker-compose.test.yml`) with it,
   and boots it to `healthy`. On branches that is all. On `main`, and only if
   `auto-service-shop` is in the `scope` list, it pushes
   `ghcr.io/zikrasoft/podbor-auto-service-shop:<sha>`, and the Caddy image it builds
   from `infra/auto-service-shop/caddy-image` for amd64 as
   `ghcr.io/zikrasoft/podbor-carlab-caddy:<sha>`, both only when all four
   `AUTO_SERVICE_SHOP_VPS_*` secrets are set; otherwise the step says so and finishes
   without pushing.
2. `deploy-shop` tars the stack files over ssh into `/srv/carlab`, logs the server
   into GHCR with the job's one-shot token (piped on stdin, never on a command
   line), runs `deploy.sh <sha>` and logs out (including on failure). This job
   **does not move** the `deployed/auto-service-shop` tag: the next one, `record-shop`,
   does, with its own `contents: write`; the token `deploy-shop` sends to the
   server cannot write to the repository.
3. `deploy.sh`: refuses without `.env` and for anything that is not a 40-character
   sha; pulls the image; dumps the database to
   `/var/backups/carlab/db-<stamp>-pre-deploy.dump` and stops if the dump fails,
   then deletes all but the newest three pre-deploy dumps;
   runs migrations in a one-off container
   (`medusa db:migrate --execute-safe-links --all-or-nothing` from `/server`), then
   checks the migrated schema against what the migrations build
   (`medusa exec ./src/scripts/check-schema.js`, the assertions of
   `src/lib/schema-check.ts`; it catches a database that ran an older version of a
   migration file or was restored from an old dump, and names each difference),
   then the production seed in another (`medusa exec ./src/scripts/seed-production.js`,
   see below); only after all three succeed does `MEDUSA_TAG` in `.env` change, with the
   old one going to `.previous-tag`; `up -d --wait`; `caddy reload`; then checks
   `https://api.carlab.rs/health/ready`. It prints stage names and the tag, never a value
   from `.env` (`infra/auto-service-shop/test/scripts.test.sh` plants a canary secret and
   fails if any script prints it).
4. `record-shop` moves `deployed/auto-service-shop` only if `deploy-shop` actually shipped
   the image (`outputs.deployed == 'true'`).
5. `deploy-site` waits for `deploy-shop`, and its carlab.rs leg is held back if
   it failed, so carlab.rs never prerenders against a backend that failed to
   ship. Right after writing the env the carlab.rs leg probes
   `MEDUSA_BACKEND_URL/health` (`.github/scripts/shop-backend-up.sh`, a few
   retries over about 20 seconds). If the backend does not answer,
   `upload-site.sh` exits 75, the leg prints a `::warning::`, skips the build
   and the deploy, and leaves `deployed/auto-service` where it was, so the
   live site keeps serving the last build and the next run retries. Without the
   probe, a VPS outage would fail every carlab.rs deploy, since the storefront
   build throws when the backend it is pointed at is unreachable.

   The build never reads `/store/catalogue-snapshot`: every catalogue page is
   rendered on demand (ADR-0065). It reads the light page list
   (`/store/catalogue-pages`, once per build: the services and works pages'
   Category links, the Make list for Keystatic and the shrink guard share it)
   and `/store/categories`. The catalogue sitemap, `llms.txt`, the parts hub and
   `https://carlab.rs/catalogue-build.json` (how many part pages the live site
   serves) render on demand from the same endpoints. A production build (`upload-site.sh` sets
   `CATALOGUE_SHRINK_GUARD=true`) reads that record from the live site first, and once it counts
   any part pages the catalogue is live: the build then fails without
   `MEDUSA_BACKEND_URL`, on zero part pages, and on fewer than half of what the
   live site serves. A shrink that is meant (a supplier removed) goes through
   with `CATALOGUE_SHRINK_ALLOWED=true` in the carlab.rs build env for one
   build; remove it afterwards. The guard covers code releases only: a Publish
   does not build the site, it changes the catalogue the live pages render
   from, so no build guard sees a Publish. Part pages list only published
   numbers, the same ones search finds.

The production seed (`apps/auto-service-shop/src/scripts/seed-production.ts`) runs on
every deploy and is idempotent. It creates the cash-at-pickup commerce defaults
(store, the `CarLab parts shop` sales channel, the Serbia region), the seven
Categories carlab.rs's old `/{locale}/parts/{slug}/` pages 301 to, with their
Russian name and text and the old picture from `apps/auto-service-shop/assets/categories`
(the image copies that directory to `/server/assets`), and «Аккумуляторы»
(`batteries`) with its twelve fields, their options and the battery registration
service (label, price, note), from the same definitions the demo seed uses.
Batteries ship without a picture: upload one in the admin. Serbian and English
come from the admin's Publish chain like any other catalogue text. A Category,
field or option a person has edited (`updated_by` set) is never touched again; an
unedited one gets its seeded values and missing image back.

It also configures the crawled catalogues, from `CRAWLED_CATALOGUES` in
`apps/auto-service-shop/src/lib/production-seed.ts`, one entry per crawled site: the
Supplier (with cross-references, applicability and images released), its Brands with the spelling the site prints (MANN-FILTER, FILTRON,
VARTA, and febi, SWAG and Blue Print for bilstein group), its known category
mappings (VARTA `battery` to «Аккумуляторы»; the nine MANN-FILTER filter families to «ТО и расходники», `Ventilator` to «Двигатель» and `Hydraulic Transmission Filter` to «Трансмиссия и приводы»; five FILTRON families to «ТО и расходники», `Sušač` to «Тормозная система» and `Filter hidrauličnog prenosa` to «Трансмиссия и приводы»; bilstein group's generic article names seen so far:
brake discs, pads, calipers, hoses, drums and handbrake cables to «Тормозная
система», shock absorbers, control arms and their mounts, stabiliser mounts and
axial joints to «Подвеска и рулевое», oil, air, fuel and cabin filters to «ТО и
расходники», V-ribbed belts and timing belt kits to «Двигатель») and, for the three sites that list cars,
every Make alias of the car Make table `CAR_MAKES` in
`apps/auto-service-shop/src/lib/suppliers/makes.ts` (`SKODA` on Škoda, `VOLVO CARS` on
Volvo, `VW (VOLKSWAGEN)` on Volkswagen, ...). The
same `updated_by` rule holds for each of these rows. A Brand or Make is found by
its name, then its slug, then the seeded spelling that points at it, so a staff
rename of either does not seed a duplicate. Deleting a spelling or a mapping in
the admin is a soft delete, and the seed reads a deleted row as the staff's
decision and leaves it deleted. Every other site category is still mapped by
hand on the Supplier's categories screen, where «Исключить» excludes a category
instead of mapping it (a mapping with no Category; the seed excludes MANN-FILTER's
`Hydraulics`, `Compressed Air-Oil Separation` and `EDM Filter` and FILTRON's
`Hidraulika`). An import skips every article of an unmapped or excluded
category and its report counts them, unmapped ones by code; a Supplier with no
mapping at all imports nothing. Each seeded mapping also names its part type
(«Салонный фильтр», «Тормозные колодки», ...), and a crawled Part is named
«type brand number» from it, so one type reads the same across suppliers; a
battery is named from its attributes, and a mapping without a type leaves the
name to AI. A crawled image that could not be copied is counted in the
report and asked for again only after a week.

It seeds no Parts or offers: the manual supplier is created on the first
hand-entered offer, and the demo data lives in `seed.ts` / `seed-demo.ts`, which
never run in production. `seed-demo.ts` ends with the production seed, so a local
demo database carries the same crawled Suppliers, Brands and aliases.

`scope` treats `apps/auto-service-shop` like any other app, plus one rule: a change under
`infra/auto-service-shop/` redeploys it, because turbo cannot see files outside the
workspace.

CI places the stack files before `deploy.sh` and outside its lock: if a migration
fails, the new `docker-compose.yml` and `Caddyfile` sit next to the old image, and
the next restart or rollback will bring the old image up with them.

Until the shop's first deploy (the `AUTO_SERVICE_SHOP_VPS_*` secrets) there is no
`deployed/auto-service-shop` tag, and every push to `main` builds, migrates and boots the
image while carlab.rs waits for `deploy-shop`. That is expected, not a `scope` bug.

### Rollback

```bash
ssh deploy@<IPv4> '/srv/carlab/deploy.sh "$(cat /srv/carlab/.previous-tag)"'
```

Do not run that command twice: the rollback itself rewrites `.previous-tag` with the
bad sha, and a second run would ship it back. Note the good sha down before rolling
back (`cat /srv/carlab/.previous-tag`).

Only the image rolls back: migrations do not. If the ship changed the schema,
restore the `db-<stamp>-pre-deploy.dump` that deploy wrote just before migrating
instead: Medusa's migrations are not guaranteed to be backwards compatible, and an
old image against a schema already migrated forward may fail to boot or corrupt
data. The shop's own migrations stay additive for the same reason ([shop-migrations.md](shop-migrations.md)). After a manual rollback the
`deployed/auto-service-shop` tag points at a version that is not in production; delete it
once the fix is in `main`.

### Backup and restore

```bash
ssh deploy@<IPv4> /srv/carlab/backup.sh
ssh deploy@<IPv4> 'ls -la /var/backups/carlab'
ssh deploy@<IPv4> '/srv/carlab/restore.sh /var/backups/carlab/db-<stamp>.dump'
```

The nightly backup keeps seven days in `/var/backups/carlab` on the same VPS, and
then copies the new database dump to an S3-compatible bucket (an AWS S3 bucket in
another region than the instance, with the endpoint
`https://s3.<region>.amazonaws.com`; Backblaze B2 or Cloudflare R2 work the same) when
`/srv/carlab/.env.backup` names one: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`
(optionally `bucket/path`), `BACKUP_S3_ACCESS_KEY_ID`,
`BACKUP_S3_SECRET_ACCESS_KEY` and, where the provider wants one,
`BACKUP_S3_REGION` (template: `infra/auto-service-shop/backup.env.example`). The keys
live in their own file rather than in `.env` because compose hands `.env` to the
Medusa container, and a compromised backend must not be able to delete its own
backups. The upload runs in a pinned `rclone/rclone` container, so the host needs
nothing installed; the keys reach it through a temporary env file, never a command
line. Copies older than 30 days are deleted from the bucket (on B2, also set the
bucket's lifecycle to drop hidden versions, or deleted files keep costing). Without
a bucket the backup still succeeds and prints a warning to
`/var/log/carlab-backup.log`; a failed upload exits non-zero and leaves the local
copy intact.

Any nightly run that exits non-zero (a failed dump, a failed off-site copy, a
skipped night because a deploy held `.deploy.lock`) posts one message to the CRM
Telegram group through `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_ID` from
`/srv/carlab/.env`, the same values the shop's order alerts use. The token reaches
`curl` through a config on stdin, never a command line or the log. With either
variable empty the failure only reaches the log; a Telegram error never changes
the backup's own exit code. `backup.sh fetch` is run by hand and never alerts.

Restoring from the bucket (a lost server) is one more step before `restore.sh`:

```bash
ssh deploy@<IPv4> '/srv/carlab/backup.sh fetch'            # list the stamps in the bucket
ssh deploy@<IPv4> '/srv/carlab/backup.sh fetch <stamp>'    # download that dump into /var/backups/carlab
```

`restore.sh` refuses to write into a database that already has tables unless
`RESTORE_OVER_EXISTING=yes` is set. On a clean server (DR) the first deploy comes
first (compose will not come up without `MEDUSA_TAG` in `.env`), and only then
`RESTORE_OVER_EXISTING=yes /srv/carlab/restore.sh …` over the empty migrated
database, then a Publish to rebuild search. `backup.sh` takes the same
`.deploy.lock` as `deploy.sh`: if a deploy is running at 03:30, the backup is
skipped with a non-zero exit code and a line in `/var/log/carlab-backup.log`.

#### Restore drill

Proves the off-site copy restores without the server, so it never touches
production. Run it on any machine with Docker (the owner's Mac is fine), once
before the shop opens and again after any change to `backup.sh` or the bucket,
then post the result on the tracking issue: the stamp restored, the counts below
and how long it took.

```bash
mkdir -m 700 ~/carlab-drill && cd ~/carlab-drill
cp <repo>/infra/auto-service-shop/backup.sh .
# write .env.backup here (mode 600) with the same values as /srv/carlab/.env.backup
BACKUP_DIR=$PWD/dumps ./backup.sh fetch                 # pick the newest stamp
BACKUP_DIR=$PWD/dumps ./backup.sh fetch <stamp>
docker run -d --name carlab-drill -e POSTGRES_USER=carlab -e POSTGRES_DB=carlab \
  -e POSTGRES_PASSWORD=drill postgres:16.15-alpine
until docker exec carlab-drill pg_isready -U carlab -d carlab; do sleep 1; done
docker exec -i carlab-drill pg_restore -U carlab -d carlab --no-owner \
  --single-transaction <dumps/db-<stamp>.dump
docker exec carlab-drill psql -U carlab -d carlab -tAc \
  "select (select count(*) from pg_tables where schemaname = 'public'),
          (select count(*) from part_identifier),
          (select count(*) from \"order\")"
docker rm -f carlab-drill && cd ~ && rm -rf ~/carlab-drill
```

It passes when `pg_restore` exits 0 and the counts match the live admin's
catalogue and orders as of the dump's night. Use the same Postgres image as
`docker-compose.yml`. Delete the folder afterwards: the dump holds customers'
orders and `.env.backup` holds the bucket keys.

Migrations and creating an admin run from the image only
(`docker compose exec -T medusa node_modules/.bin/medusa …`), never from a
repository checkout: the image has no ts-node.

### Data lifecycle

Scheduled jobs in the shop (`apps/auto-service-shop/src/jobs`) keep the tables
that would otherwise grow forever or hold personal data longer than needed:

- **VIN lookups, 90 days** (`scrub-vin-lookups`, nightly). A `vin_lookup` row keeps
  the full VIN, the decoder's raw answer and the decoded facts for 90 days after
  the last lookup of that VIN. Then the job clears `vin`, `raw` and `facts` and
  keeps the WMI (the first three characters of the VIN), the make, the type code,
  the decoded Vehicle and the row itself, so the unresolved-codes counts stay
  right. A later lookup of the same VIN is a new row. Each lookup is a
  `vin_lookup_hit` row (source, bot flag, visitor id); its visitor id is
  cleared 90 days after that lookup, its source and bot flag stay. The carlab.rs privacy page
  states this retention; change both together. The nightly dumps still hold a
  scrubbed VIN for up to 30 days (the off-site retention above).
- **Search, rebuilt nightly** (`reindex-search`). The job wakes every hour
  and at 04:00 Europe/Belgrade (summer time included) swaps both indexes,
  `part_identifier` and `catalogue_car`, from scratch. It is the safety net
  under the incremental Publish: anything an incremental change missed is
  right by the next morning.
- **Catalogue runs, 90 days** (`prune-catalogue-runs`, nightly). Finished import,
  Publish, deletion, merge and rename runs older than 90 days are deleted with
  their `report`, except the newest run of each kind per Supplier, which the
  admin shows as the last one.
- **Carts, 14 days** (`delete-stale-carts`, nightly).
- **Part Demand, 120 days** (`refresh-part-demand`, nightly). Deletes
  `part_demand_day`, `missed_query` and `demand_receipt` rows older than 120
  days, then reindexes every number with demand in the last 31 days so the
  «Популярные» sort follows the sliding 30-day score (ADR-0060). The rows hold
  identifiers, counts and redacted queries, nothing personal.
- **Site access log, 7 days** (Caddy, `/data/access.log` in the `caddydata`
  volume). Every request to the three sites, with the client IP and User-Agent,
  to tell crawlers from people. Caddy rolls it at 100 MiB and deletes rolls
  older than 7 days; Alloy never ships it to Loki.

The crawl tables (`crawl_run`, `crawl_page`) belong to no Medusa module on
purpose: only the crawler on the owner's Mac writes them, through raw SQL under
its own Postgres role (`crawler-role.sh` grants it exactly these two tables), and
a module would hand them to a service no Medusa code calls. The supplier module's
hand-written migration creates them, and `src/lib/schema-check.ts` lists their
columns and indexes, and checks the `crawl_page_status` and `crawl_page_error`
CHECKs against `PAGE_STATUSES` and `FAILURE_REASONS` in
`src/lib/crawler/store.ts`, so the deploy-time schema check and the schema spec
still see them.

`fitment` keeps two indexes the planner never needs: the generator's partial
`IDX_fitment_part_id` and `IDX_fitment_vehicle_id`, covered by the hand-written
`IDX_fitment_part_vehicle_all` and `IDX_fitment_vehicle_all`. Dropping them would
make the drift check regenerate them, so their write cost is accepted. Add no
further partial index on this table; the one deliberate addition is
`IDX_fitment_source`, which deleting a source's rows scans.

### Monitoring

The owner hears about an outage from an uptime check and about a server error
from Sentry. Both accounts are the owner's; the code only reads one variable.

**Two health routes.** `/health` is Medusa's own and answers `OK` while the
process runs, whatever the database does. `/health/ready`
(`apps/auto-service-shop/src/api/health/ready/route.ts`) runs `select 1` on Postgres
and asks Typesense's `/health` (giving it 3 seconds), and answers
`200 {"status":"ok"}` or `503 {"status":"unavailable"}`. The response never says
which one failed or why; the container log does:
`docker compose logs medusa | grep 'Health check failed'` prints
`postgres`, `typesense` or both. The image's `HEALTHCHECK` and `deploy.sh` use
`/health/ready`, so a Typesense that does not come up fails the deploy rather
than shipping a shop without search. carlab.rs's build probe
(`.github/scripts/shop-backend-up.sh`) stays on `/health`: it only asks whether
the backend answers.

**The uptime check.** Any external monitor that can alert in Telegram works
(UptimeRobot, for one, has a Telegram alert contact; check that the chosen plan
includes it). Set it up once:

1. Create an HTTP(S) monitor on `https://api.carlab.rs/health/ready`, expecting
   status 200, every 5 minutes or more often, with a timeout of about 10 seconds.
   Add one more for each site on its bare root: `https://approved.rs/`,
   `https://carlab.rs/` and `https://details.rs/`, same interval and timeout,
   following redirects. The sites have no health route, and every other page is
   a file Caddy answers from disk, but `/` has no file: Caddy hands it to the
   site's Node container, whose middleware 302s it to the visitor's locale. A
   container that is down or out of memory turns it into a 502.
2. Add Telegram as an alert contact, the way the service's own guide describes
   (usually a bot you start in Telegram that links the chat), and attach it to
   the monitor for both "down" and "up again".
3. Send the service's test notification and confirm it arrives.

Done: the monitor shows the endpoint up, and stopping Typesense on the server
(`docker compose stop typesense`) produces a "down" message in Telegram within
one interval; `docker compose start typesense` produces the "up" one.

**Sentry.** Create a Sentry project for the platform Node.js (Express), copy
its DSN into `/srv/carlab/.env` as `SENTRY_DSN=`, and `docker compose up -d
medusa`. `apps/auto-service-shop/instrumentation.ts` starts the SDK when Medusa
boots; with `SENTRY_DSN` empty it does nothing and `captureException` is a
no-op. What reaches Sentry: every request that ends in a 5xx (the shop's error
handler in `src/lib/admin-errors.ts`; 4xx never) and uncaught exceptions. What
does not, by `src/lib/sentry.ts`: the request (URL, query, headers, cookies,
body), the user, breadcrumbs, local variables and database query data, and no
tracing. The exception message and stack still go, so a thrown message must not
carry a phone number or an address. Sentry mails the project's members about a
new issue by default; that is the alert. A DSN only lets someone send events to
the project, but keep it in `.env` like everything else and out of the
repository.

Done: `cut -d= -f1 /srv/carlab/.env` lists `SENTRY_DSN`, the medusa log shows
no Sentry error after the restart, and the next 5xx appears as an issue in the
project.

### Logs: Events, Loki and Grafana

Why it is built this way: [ADR-0057](../adr/0057-shop-events-are-json-lines-in-loki.md).
The shop writes one JSON line per **Event** to its stdout, a stable `event` name
first, then `at`, `request_id`, `outcome`, `reason` and the event's own fields;
the vocabulary is `apps/auto-service-shop/src/lib/log-event.ts`. carlab.rs
posts its own Events to the shop (above, `SHOP_EVENTS_SECRET`), which logs them
the same way under `storefront.*`. No Event holds a phone, a name, a handle, an
email or an address: the client is a 12-character keyed hash of its network,
a VIN is its first three characters and a keyed hash. Medusa's own request
line (morgan, with the client IP and the full URL) is off: compose sets
`LOG_LEVEL=info` on medusa.

Alloy reads the Docker log files of the stack from
`/var/lib/docker/containers` (read-only, no Docker socket), keeps the medusa
service's lines, labels each with its `event`, and pushes them to Loki; it
drops anything above 10 lines a second (bursts of 2000), so a flood of
requests cannot fill the disk. Loki keeps 30 days and deletes older chunks
itself. At that cap the worst case is about 2 GB of compressed chunks; at
real traffic it is tens of MB. Check with
`docker system df -v | grep carlab_lokidata`.

**Opening Grafana.** It runs only behind the `grafana` compose profile, to keep
the three site containers inside the host's memory budget: start it with
`docker compose --profile grafana up -d grafana` before you open the tunnel,
and `docker compose stop grafana` when you are done. It listens on the server's
`127.0.0.1:3000` only, and
`deploy` may open a tunnel to that one address and nothing else. On a server
hardened before this, rerun the hardening once (it keeps the crawler's key):

```sh
scp infra/auto-service-shop/harden-ssh.sh deploy@<server>:/tmp/
ssh -t deploy@<server> sudo sh /tmp/harden-ssh.sh
```

Then, from your machine:

```sh
ssh -N -L 3000:127.0.0.1:3000 deploy@<server>
```

then open `http://localhost:3000` and sign in as `admin` with
`GRAFANA_ADMIN_PASSWORD`. The **CarLab shop** dashboard shows errors by cause
with the latest ones, requests and p95 latency by route, searches by intent,
the zero-result rate and the top zero-result queries, the unresolved VIN rate
and codes, and inquiries, checkouts and order hand-offs by outcome. Explore
takes any LogQL, for example every line of one request:
`{service="medusa"} |= "<request_id>"`.

Done: the tunnel opens Grafana, the dashboard has data after a search on
carlab.rs, and `curl -sI http://<server>:3000` from outside times out.

**The weekly export for Claude.** Once a week, on the server:

```sh
ssh deploy@<server> /srv/carlab/logs-export.sh
```

It reads the last 7 days of Events from Loki (an argument changes the days:
`logs-export.sh 14`), only lines with an `event` label, never Medusa's own text,
and writes `/srv/carlab/exports/carlab-events-<date>.jsonl.gz` (one Event per
line, oldest first) and `carlab-events-<date>.summary.txt` (counts per event
and outcome), printing both paths; exports older than eight weeks are deleted.
Copy them to your machine and hand both files to Claude with a question such
as "what do people search for and not find, and where do they give up":

```sh
scp 'deploy@<server>:/srv/carlab/exports/carlab-events-*' .
```

The files hold no personal data by construction, but they are still your
business data: keep them out of the repository and public chats.

Checked by `infra/auto-service-shop/test/logs.test.sh`, which brings up Loki,
Alloy and Grafana from this compose file, feeds them fake medusa lines and
checks what reaches Loki, the dashboard queries, the export and Grafana's
provisioning.

### Checking the stack locally

The same compose comes up on your own machine with no separate override, through
variables in `infra/auto-service-shop/.env` (covered by `.gitignore`'s `.env`):
`API_HOST=localhost`, `HTTP_PORT=8080`, `HTTPS_PORT=8443`,
`MEDUSA_IMAGE=podbor-auto-service-shop`, `MEDUSA_TAG=local`, plus the secrets. The image
comes from `docker build -f infra/auto-service-shop/Dockerfile -t podbor-auto-service-shop:local .`,
and Caddy's from `docker build -t ghcr.io/zikrasoft/podbor-carlab-caddy:local infra/auto-service-shop/caddy-image`.
Check with `curl -k https://localhost:8443/health/ready`.

### Easy to miss

- **The admin opens in Russian.** Medusa keeps the admin language in the
  browser (the `lng` cookie and `localStorage` key), not on the user, and falls
  back to English. `adminLanguage` in `apps/auto-service-shop/src/lib/admin-language.ts`,
  wired through `admin.vite` in `medusa-config.ts`, sets `ru` once per browser;
  a language picked later under Profile → Language sticks.
- **`.env` is read literally.** `deploy.sh` pulls values out of `.env` with `sed`
  and does not strip quotes: do not wrap values in `"…"`, or the quotes end up in
  the value.
- **`umask 077` on the server.** `deploy.sh` and `backup.sh` set it themselves:
  `.env` and the backup files in `/var/backups/carlab` land with mode 600/700 owned
  by `deploy`.
- **Only Caddy exposes a port.** `ports:` in docker compose bypasses ufw: the rule
  filters traffic on the host, not what Docker forwards itself through iptables.
  Never add `ports:` to another service in the compose stack. The DigitalOcean
  cloud firewall `carlab-shop` (Terraform) sits in front of the Droplet and does
  filter it: inbound exactly 22/tcp, 80/tcp, 443/tcp and 443/udp. Its outbound
  rules must stay open, or apt, GHCR, S3 and Let's Encrypt stop working.
- **Use the reserved IP everywhere.** A rebuilt Droplet gets a new public IPv4;
  the reserved IP moves to it. Write it, not the Droplet's own address, into DNS
  and `AUTO_SERVICE_SHOP_VPS_HOST`. It is free while assigned and billed once
  unassigned.
- **SSH as root stops working after hardening.** The Droplet's first login is
  `root`, and `harden-ssh.sh` allows only `deploy` and `crawler`. Keep a working
  `deploy` key; if it is lost, use the Recovery Console in the DigitalOcean
  control panel.
- **Docker's apt key is not verified by fingerprint.** `bootstrap-host.sh` does not
  pin the fingerprint of Docker's GPG key. After bootstrapping, check it by hand
  with `gpg --show-keys /etc/apt/keyrings/docker.asc` against the fingerprint
  Docker's own documentation publishes.
- **CI's key is effectively root.** `deploy` is in the `docker` group (and has
  `NOPASSWD` sudo); the `docker` group is equivalent to root by itself, so
  `restrict` in `authorized_keys` only limits forwarding and pty. An accepted risk.
- **`ufw limit 22/tcp`** allows no more than 6 new connections per 30 seconds from
  one address. `deploy-shop` opens 4 ssh connections per run (the stack files, the
  GHCR login, `deploy.sh`, the logout): there is headroom, but do not add ssh calls
  to that job carelessly.
- **The backup cron runs in the host's timezone**, UTC on DigitalOcean's Ubuntu image
  (check with `timedatectl`).
  `/var/log/carlab-backup.log` grows without bound; add a logrotate snippet by hand:
  ```
  /var/log/carlab-backup.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
  }
  ```
- **Ubuntu 24.04 runs ssh through socket activation**: `systemctl reload ssh` after
  `harden-ssh.sh` may not report what you expect. Before closing the first session,
  open a second terminal and confirm that key-based login as `deploy` still works.
- **Caddy has no CSP yet**: `caddy/Caddyfile` sets HSTS, `X-Content-Type-Options`,
  `Referrer-Policy` and `X-Frame-Options` and removes `Server`.
- **Editing `pnpm-lock.yaml` redeploys the shop too**: one lockfile for every app,
  and `scope` cannot attribute an edit to one of them. A surplus deploy is cheaper
  than a missed one.

### The first ship: a checklist

> For the human who owns the infrastructure. An agent does not execute this
> section: every step happens outside the repository (AWS console, DNS at the
> registrar, GitHub Secrets).

Steps 1, 5 and 6 are one `terraform apply`: see `infra/auto-service-shop/terraform/README.md`.

1. **Droplet.** In `fra1`: Ubuntu 24.04 LTS, Basic `s-2vcpu-4gb` ($24: 4 GB,
   2 vCPU, 80 GB SSD), your own ssh key, no paid backups; a reserved IP assigned
   to it; the cloud firewall `carlab-shop` allowing inbound 22/tcp, 80/tcp,
   443/tcp and 443/udp (HTTP/3) and all outbound.

   Done: the Droplet shows the reserved IPv4 and the firewall with four inbound rules.

2. **Bootstrap.** Log in as `root` with your key, upload
   `infra/auto-service-shop/bootstrap-host.sh` and `infra/auto-service-shop/harden-ssh.sh`, and
   run `sh bootstrap-host.sh`: it gives `deploy` root's keys (or, run through
   `sudo`, the keys of the user who ran it). Open a separate session, `ssh deploy@<IPv4>`, and **keep it open** until
   key-based login has been re-verified after hardening. From it, run
   `harden-ssh.sh` **through `sudo`** (with the crawler's public key, see
   [The crawler on the owner's Mac](#the-crawler-on-the-owners-mac), or without it
   for now).
   Done: `ssh deploy@<IPv4>` lets you in by key; `ssh root@<IPv4>` refuses.
3. **DNS.** A records for `api.carlab.rs` and `admin.carlab.rs` at the reserved IPv4.
   Done: `dig +short` returns it for both names.
4. **`.env` on the server.** Copy `infra/auto-service-shop/production.env.example` to
   `/srv/carlab/.env`, fill in every value (secrets with `openssl rand -hex 32`),
   then `chmod 600 /srv/carlab/.env`.
   Done: `ssh deploy@<IPv4> 'stat -c %a /srv/carlab/.env'` prints `600`.
5. **Shop buckets.** Create the public and the private S3 bucket and the shop's
   IAM user as in [Files on S3](#files-on-s3), and put their values in
   `/srv/carlab/.env`. Create the crawler's IAM user with the private-bucket
   policy there too; its key goes only to the Mac's `.env.crawler`.
   Done: `cut -d= -f1 /srv/carlab/.env | grep '^S3_'` lists the five required names.
6. **Backup bucket.** Create a private AWS S3 bucket in another region than the
   instance (or at Backblaze B2 or Cloudflare R2) and an IAM user whose key is
   limited to that bucket, separate from the shop's. The carlab AWS account's
   organization allows only `eu-north-1`, so for now the backup bucket sits in
   the instance's region: it survives a lost server, not a regional outage.
   `backup_region` in the Terraform moves it once a second region or B2/R2 is set up.
   Copy `infra/auto-service-shop/backup.env.example` to `/srv/carlab/.env.backup`, fill
   it in, `chmod 600` it.
   Done: `ssh deploy@<IPv4> 'stat -c %a /srv/carlab/.env.backup'` prints `600`.
7. **CI secrets.** Generate CI's ssh key (`ssh-keygen -t ed25519`), restrict the
   public half on the server (`restrict` in `authorized_keys`), obtain
   `known_hosts` (`ssh-keyscan -t ed25519 <IPv4>`) and **verify the fingerprint**
   separately. Record `AUTO_SERVICE_SHOP_VPS_USER`, `AUTO_SERVICE_SHOP_VPS_SSH_KEY` and
   `AUTO_SERVICE_SHOP_VPS_KNOWN_HOSTS` in the **repository's** secrets, and
   `AUTO_SERVICE_SHOP_VPS_HOST` **last**: with it in place, the next push to `main`
   deploys.
   Done: all four secrets are visible in Settings → Secrets and variables → Actions.
8. **The first deploy.** A push to `main` or Actions → CI → Run workflow. Check the
   package in GHCR: linked to the repository, Actions read access configured.
   Done: `deploy-shop` is green, `record-shop` moved `deployed/auto-service-shop`, and
   `https://api.carlab.rs/health/ready` answers 200.
9. **Admin.** Create an admin
   (`docker compose exec -T medusa node_modules/.bin/medusa user --invite`), sign in
   at `https://admin.carlab.rs`, and in Settings → Publishable API Keys create the
   key carlab.rs uses, with the `CarLab parts shop` sales channel added to it (the
   production seed created the channel).
   Then open «Аккумуляторы»: the production seed created it with its twelve
   fields, their options and the battery registration service (label, price,
   note). Check the price is still right and upload the Category's picture,
   which the seed does not ship.
   The crawled Suppliers, their Brands and spellings, the VARTA, MANN-FILTER, FILTRON and bilstein group category mappings
   and the Volkswagen aliases are seeded too: nothing to set up before the first
   crawl and Import.
   Done: signing in works, the eight seeded Categories are in the admin,
   «Аккумуляторы» shows its fields, the registration service and a picture, and
   the Suppliers screen lists the four crawled sites.
10. **The shop's `.env` values for carlab.rs.** In `/srv/carlab/.env`:
    `STOREFRONT_ORIGIN=https://carlab.rs` (orders go to its `/api/shop-orders`,
    see [`.env`](#env)), `SHOP_OPEN=false` while the shop is
    closed, and `OPENAI_API_KEY` as described in
    [`.env`](#env); `docker compose up -d medusa` after editing.
    Done: `cut -d= -f1 /srv/carlab/.env` lists all three names.
11. **carlab.rs env.** In the `site-auto-service` GitHub environment:
    `MEDUSA_BACKEND_URL=https://api.carlab.rs`, `MEDUSA_PUBLISHABLE_KEY` = the key
    from step 9, and `SHOP_OPEN` **unset** until the shop opens. Then press Publish
    in the admin so the Categories get their Serbian and English text, then deploy
    carlab.rs so its prerendered services pages link the Categories.
    Done: `https://carlab.rs/sr/parts/brakes/` 301s to `/sr/parts/c/brakes/`, which
    answers 200 with the Category's text and picture. From now on a carlab.rs deploy
    while `https://api.carlab.rs/health` is down is skipped with a warning in the
    CI run rather than failed, and the next run retries it (see
    [How it ships](#how-it-ships)); a Publish in that state fails.
12. **Acceptance.** `docker stats --no-stream` under light load stays within the
    memory limits; a manual `ssh deploy@<IPv4> /srv/carlab/backup.sh` works and
    ends with `Copied to the <bucket> bucket`, and `backup.sh fetch` lists the new
    stamp; the next morning `/var/log/carlab-backup.log` shows the cron ran,
    without the `BACKUP_S3_BUCKET is not set` warning.

---

## Setting up a new site

1. Add the app to the manifest, `.github/scripts/site-env.json` (`sites.<app>`);
   the `deploy-site` matrix follows it, and `site-env.test.ts` tells you which
   names its code reads.
2. Create its GitHub environment, `site-<app>` (Settings → Environments), and
   set its names there per the manifest: secrets as secrets, the rest as
   variables. Shared names are already at repository level.
3. The GitHub App for Keystatic (see above), into the same environment.
4. Point the domain's A record at the VPS, where Caddy serves it from
   an `import site <app>` block beside a `site-<app>` service (see
   [The server](#the-server)); `infra/auto-service-shop/test/sites.test.sh`
   fails until compose and the Caddyfile name the same sites as the manifest. `CRM_DATABASE_URL` is not a GitHub value:
   compose sets it on the site container.

Only then the first deploy. A deploy missing a required name fails, naming it,
before it builds. The first run without a `deployed/<app>` tag deploys the app
unconditionally and creates the tag; after that, a green run with no deploy at
all is the normal state.

---

## Content auto-translation

Case studies (`src/content/cases`, `works`, `products`) and UI copy
(`src/content/i18n/*.yaml`) are translated automatically. The admin in Keystatic
writes only the Russian fields — none of the four languages under `translations` is
required there, because Keystatic cannot make an API call from its own form, so a
"Translate" button cannot exist there in principle.

In its place there is the `translate` job in `.github/workflows/ci.yml`: on every
push to `main`, and on a manual `workflow_dispatch` run for any other branch, it
walks every `apps/*/` and runs each script it finds (`translate-cases`,
`translate-works`, `translate-i18n`), then commits the result back to the branch it
ran on.

A manual run on a feature branch is safe: `git.deploymentEnabled` is `false`
throughout and Vercel does not deploy on a git push for any branch, so a translation
commit on a feature branch cannot start a surplus build. On `main` the
deploy jobs follow `translate` in the same run and check out exactly the commit it
left behind — but only what has fallen behind production ships from them (see "Not
everything gets deployed"). The `translate` step itself is unconditional: it is one
step for all three apps and runs on every push, because every string is looked up in
the cache first — a run with nothing to translate makes no request to OpenAI at all.

The unit of work is one string: the cache at
`apps/<app>/src/content/translations.cache.json` must stay committed, and deleting
it costs a full regeneration of the corpus (~112 thousand characters per locale). How
the cache, `translatedFrom` and hand edits to translations work —
[ADR-0009](../adr/0009-translation-runs-in-ci-before-deploy.md).

Without `OPENAI_API_KEY` the job fails at the translation step — existing content is
unaffected, only new or changed text stays untranslated until the next successful
run. A manual run must happen from inside the app (the scripts resolve content
relative to the working directory). There is no dry-run mode: the script calls
OpenAI and rewrites the content, `translatedFrom` and the cache, so it is only run
locally to debug the script itself:

```bash
cd apps/approved-rs
node --env-file=.env --experimental-strip-types scripts/translate-cases.ts
```

---

## The Telegram webhooks

Two kinds, and only the CRM one is carlab.rs-only.

- **`/api/telegram-webhook`** — `@SerbCRMBot`, the CRM bot. One bot, so one
  webhook, and it lives in carlab.rs; approved.rs and details.rs have no such
  route. Its `secret_token` is carlab.rs's `TELEGRAM_WEBHOOK_SECRET`.
- **`/api/telegram-capture`** — the brand's own capture bot, in **all three**
  projects. `@ApprovedRsBot` is registered against `crm.carlab.rs`, `@CarLabRsBot`
  against `carlab.rs`, `@DetailsRsBot` against `details.rs`, each with that
  project's `TELEGRAM_CAPTURE_WEBHOOK_SECRET`
  ([ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).

Each is registered once per bot, four registrations in total. The CRM bot
and approved.rs's capture bot are registered on `crm.carlab.rs`: Caddy's
`CRM_HOST` passes `/api/telegram-webhook` to carlab.rs's node,
`/api/telegram-capture` to approved.rs's, and answers 404 to anything else, so
both bots follow the host rather than approved.rs's DNS.

### The CRM bot

The group receives a short teaser of the lead ("#123 · Ivan · Vehicle
sourcing · status") with the status buttons (✅ deal / ❌ lost, then 🗣 negotiations, 🔵 in progress
and ⏰ postpone) and
an "Open in the bot" link button; the owner and the admin may both change a
status, and whoever did not gets a DM saying who did. Deleting is the admin's
alone and happens in a DM with
the bot, and the visitor is answered in the Lead's Topic. Statuses are new / negotiations /
in_progress / won / lost / postponed, and lost is the archive. 🗣 on the card, or the
owner's first message in the Lead's Topic, moves a new Lead into negotiations. A
postponed Lead comes back on its date to the status it left, with a DM reminder
to the owner. Leads are stored
in the `crm` Postgres database on the shop VPS.

The owner and the admin each have to message the bot `/start` once before it can
send them direct messages (including the notice of a Balance operation the other
one recorded) — Telegram forbids a bot from starting a conversation.

New cards are not pinned. A card pinned before that change is unpinned when its
Lead closes, which needs the **pin messages** admin right; without it the call
fails and is only logged.

The group runs as a **forum** (group settings → Topics on): every Lead a
visitor starts in a Capture bot gets its own Topic, which the CRM bot opens and
keeps the Lead summary in, while cards and the digest stay in General. Give the
CRM bot the **Manage topics** admin right as well — without it
`createForumTopic` fails, the failure is only logged, and the Lead carries on
without a Topic. Add the three Capture bots to the same group as admins with
**Manage topics** too: each one copies its visitors' messages into their Topic
and copies the owner's messages there — text, photos, voice, files — back out to
the visitor, which needs it to see the group, and posting into a closed Topic
needs that right. The CRM bot closes Topics (empty after a day, ✅, ❌) and
reopens them on the next message, which is the same **Manage topics** right.

The CRM bot must receive **every** group message, not only replies to its own:
the owner writes in a Topic without replying to anything, and that is the
message the CRM webhook routes by its Topic to the Lead and hands to the brand's
Capture bot. Make it an admin of the group or turn privacy mode off (BotFather →
Bot Settings → Group Privacy); a bot in privacy mode only sees replies and
commands meant for it
([Bot features → Privacy mode](https://core.telegram.org/bots/features#privacy-mode)).
Messages from bots — the Capture bots' copies of the visitor —
and from anyone who is neither owner nor admin are ignored, so the relay cannot
loop.

The webhook must carry a `secret_token` equal to the carlab.rs project's
`TELEGRAM_WEBHOOK_SECRET` — without a match the endpoint answers 401 to every
request:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://crm.carlab.rs/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

To check:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

`apps/approved-rs/scripts/register-webhook.ts` does the same thing. It takes the
bot as its one argument — `crm` reads `TELEGRAM_BOT_TOKEN` /
`TELEGRAM_WEBHOOK_SECRET` and registers `/api/telegram-webhook`, `capture` reads
`TELEGRAM_CAPTURE_BOT_TOKEN` / `TELEGRAM_CAPTURE_WEBHOOK_SECRET` and registers
`/api/telegram-capture`. Both take the target host from `SITE`, and an unknown
bot or a missing variable exits non-zero without calling Telegram. A `SITE` set
on the command line wins over the env file's:

```bash
cd apps/approved-rs
SITE=https://crm.carlab.rs node --env-file=../auto-service/.env.local --experimental-strip-types scripts/register-webhook.ts crm
```

> Until 2026-09-13 the script registered a non-existent `${SITE}/api/telegram` and
> passed `allowed_updates: ['callback_query']`, which meant direct messages to the
> bot and replies to its deal-amount prompts never reached the webhook. If the
> webhook was registered with it before then, re-register.

### The capture bots

The script reads nothing but `process.env`, so the one copy in
`apps/approved-rs/scripts/` registers all three — hand it the other project's
`.env.local`, which carries that project's `SITE` and that brand's
`TELEGRAM_CAPTURE_*`. Do not copy the script into the other two apps.

```bash
cd apps/approved-rs
SITE=https://crm.carlab.rs node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts capture
node --env-file=../auto-service/.env.local --experimental-strip-types scripts/register-webhook.ts capture
node --env-file=../detailing/.env.local --experimental-strip-types scripts/register-webhook.ts capture
```

Equivalently, by hand, once per brand:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_CAPTURE_BOT_TOKEN>/setWebhook?url=https://carlab.rs/api/telegram-capture&secret_token=<TELEGRAM_CAPTURE_WEBHOOK_SECRET>"
```

### The capture bots' profile

Each app's `scripts/capture-bot-profile.ts` sets its capture bot's description,
short description and the `/menu` and `/lang` commands, once with no language
code (the app's primary locale, what a Telegram client in any other language
sees) and once per locale the site serves. The texts are the `profile` group of
that app's `captureBot.yaml` — written in Russian, translated by the CI
`translate` job like the rest of the capture copy. Run it by hand, from inside
the app, after a change to that group has been translated and merged; until
then a locale without a translation gets the Russian text. A `{manager}` in
either description becomes `@` plus the app's `PUBLIC_TG_MANAGER`, so a visitor
who will not press Start still sees whom to write to. It is not a CI step, and
a missing `TELEGRAM_CAPTURE_BOT_TOKEN` or `PUBLIC_TG_MANAGER` exits non-zero
without calling Telegram:

```bash
cd apps/approved-rs && node --env-file=.env.local --experimental-strip-types scripts/capture-bot-profile.ts
cd apps/auto-service && node --env-file=.env.local --experimental-strip-types scripts/capture-bot-profile.ts
cd apps/detailing && node --env-file=.env.local --experimental-strip-types scripts/capture-bot-profile.ts
```

---

## The reminder cron (carlab.rs only)

Every day at 08:00 UTC the host's `carlab-reminders` timer calls
`/api/reminders` inside the carlab.rs container (see
[The server](#the-server)) with
`Authorization: Bearer $CRON_SECRET` — the route marks expired Ghost leads lost,
closes every Topic nobody has written in a day after its Lead was created (once;
a quiet conversation stays open; the next message reopens it), then posts one digest to the group: postponed leads whose day has come (returned
to the status they were postponed from once listed, with a DM reminder to the
owner) and new, negotiating or in-progress leads with no action for 7 days, each
a `#N` link that opens the Lead in the bot. It carries no buttons. Once per day,
however often the cron runs. The day's digest record remembers the message and
the Leads it lists, so when staff change one of them from its card or detail,
tap «🔵 В работе» or delete it, the message is redrawn without it (and without
Leads closed meanwhile), and «✅ Всё разобрано» replaces the last one. Nothing is posted when the list is empty.
There is no monthly summary: the Balance is in the bot's menu. Without
`CRON_SECRET` in the project the route answers 401 and the digest silently never
arrives.

The timer calls carlab.rs alone, never the other two sites: otherwise the
same reminders would go out several times over. Vercel's cron for the last deployment
that carried one is disabled in the dashboard at the cutover
([Cutover from Vercel](#cutover-from-vercel)).

---

## A custom domain

1. Point the apex and `www` A records at the VPS's reserved IP
2. Set the host in the shop's compose (`APPROVED_HOST` / `CARLAB_HOST` /
   `DETAILS_HOST`) if it is not the default, and recreate Caddy with
   `docker compose up -d caddy`: the host names reach it as environment, which
   a reload does not reread
3. Check that `site:` in that app's `astro.config.mjs` matches the domain: the canonical links, the sitemap and the OG tags
   all depend on them

---

## pnpm on Vercel

Vercel no longer builds or serves the sites; this only explains why
`pnpm-workspace.yaml` lists the allowed builds twice.

A real deploy (`git push origin main` → `ci.yml`) does not touch any of this:
`vercel build`/`vercel deploy` run from GitHub Actions, where `pnpm/action-setup`
has already installed the pnpm from `packageManager` in the root `package.json`
(currently 11.22.0) — `vercel build` runs `installCommand`/`buildCommand` in that
same process rather than in a separate Vercel container with its own pnpm.

What follows only applies to a manual deploy from the Vercel dashboard (the Redeploy
button) or to the git trigger, if `git.deploymentEnabled` is ever switched back on —
in both cases Vercel does the building itself:

- Vercel picks its pnpm version from `lockfileVersion` in `pnpm-lock.yaml`
- pnpm v11 is not officially supported by it (10 is the maximum)

So `pnpm-workspace.yaml` keeps the list of allowed builds twice, in both versions'
formats:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

allowBuilds: # pnpm v11
  esbuild: true
  sharp: true
  '@parcel/watcher': true

onlyBuiltDependencies: # pnpm v9/v10 (Vercel)
  - esbuild
  - sharp
  - '@parcel/watcher'
```

---

## Post-deploy checks

For each of the three domains:

- [ ] The homepage opens and the `/` → `/<locale>/` redirect works
- [ ] No `undefined` in the contacts (check the Telegram/WhatsApp/Viber/phone links)
- [ ] The form submits a lead → it arrives in the shared Telegram group with the
      right brand name
- [ ] Clicking the call button also reaches Telegram (`/api/contact-click`)
- [ ] `/keystatic` lets you in through GitHub and saves an edit to the repository
- [ ] HTTPS and the custom domain are active

Additionally for carlab.rs:

- [ ] The buttons in the bot's DM work (meaning the webhook and
      `TELEGRAM_WEBHOOK_SECRET` match)
- [ ] All three brands' leads are visible to the bot (meaning all three sites really
      share one `CRM_DATABASE_URL`)

Additionally for approved.rs:

- [ ] The geo banner appears when arriving from DE/RS/ES (VPN)
