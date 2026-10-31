# Deploy: three sites on Vercel, the shop backend on a VPS

## Stack

- **Astro v7** — static sites, with individual routes optionally on SSR
  (`export const prerender = false`)
- **pnpm v11 + Turborepo** — a monorepo, apps in `apps/*`, shared packages in
  `packages/*`
- **Vercel** — hosting. Three separate projects, one per app
- **GitHub Actions** — the only place where a build or a deploy actually happens
  (`.github/workflows/ci.yml`)

## Three sites, one repository

| App                 | Domain        | Brand                          | What it deploys                                                                                                             |
| ------------------- | ------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/approved-rs`  | `approved.rs` | Approved.rs — vehicle sourcing | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`, `/api/telegram-webhook`, `/api/reminders` (cron) |
| `apps/auto-service` | `carlab.rs`   | CarLab: auto service           | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`, `/api/shop-orders`                               |
| `apps/detailing`    | `details.rs`  | Details — detailing            | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`                                                   |

Each app owns its own `astro.config.mjs`, `vercel.json`, `keystatic.config.ts` and
`.env*`. The Vercel CLI identifies the project from the working directory, so every
deploy job runs entirely from its own `apps/<app>`.

**Four bots, one chat, one lead store, three brands.** `@SerbCRMBot` is the CRM
bot (cards, statuses, money, postpone and reminders), and it is the same bot
in all three projects; Telegram allows exactly one webhook
URL per bot, so `api/telegram-webhook.ts` and `api/reminders.ts` live only in
`apps/approved-rs`. `@ApprovedRsBot`, `@CarLabRsBot` and `@DetailsRsBot` are
capture bots, one per brand: each one talks to visitors, writes a lead, and has
its own `api/telegram-capture.ts` webhook in its own project
([ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).
All three apps write to the same `data/leads.json` in the same Vercel Blob store
and are separated by the lead's `brand` field, which the server stamps on
(`createBrandBot({ brand })`) — a visitor cannot set it.

> Unprefixed paths in this document are relative to the app being discussed
> (`vercel.json` in the approved.rs section means
> `apps/approved-rs/vercel.json`). The repository root holds only `.github/`, the
> linter configs, `pnpm-lock.yaml` and an "empty" `vercel.json` carrying a single
> `git.deploymentEnabled: false`.

---

## How the deploy works

### Vercel builds nothing

`git.deploymentEnabled: false` in the root `vercel.json` and in each app's
`vercel.json` disables Vercel's own git trigger — for why, see
[ADR-0007](../adr/0007-github-actions-builds-vercel-only-hosts.md).

GitHub Actions builds and deploys, and only the sites that have fallen behind
`main` (see "Not everything gets deployed" below):

- the `deploy` job — `apps/approved-rs`;
- the `deploy-brand-site` job — a matrix of `detailing` and `auto-service`.

Both do the same thing from their app's directory:

```bash
pnpm exec vercel pull --yes --environment=production
pnpm exec vercel build --prod
pnpm exec vercel deploy --prebuilt --prod --archive=tgz
```

…and as a last step (`Record what is live`) they move their own
`refs/tags/deployed/<app>` tag onto the SHA just shipped. That is how the next run
learns what is already in production.

The Vercel project exists only to hold environment variables and the domain, and to
be a deploy target. Build settings in the dashboard are irrelevant — they are
already fixed in each app's `vercel.json`:

```json
{
  "framework": "astro",
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install",
  "outputDirectory": "dist"
}
```

The same file sets the security headers on every path: `frame-ancestors 'self'`,
`nosniff`, `strict-origin-when-cross-origin`, a `Permissions-Policy` with the
camera, microphone and geolocation off, HSTS, and a script CSP in
`Content-Security-Policy-Report-Only` that allowlists GA4, Google Ads, Metrika
and the Pixel beside `'self'` and the inline Astro scripts. The three copies are
identical; change them together.

TODO: enforce the script CSP once a week of browser consoles on all three sites
shows no violation from the analytics scripts or the map embed.

### Job order

`check` (lint/prettier/typecheck/test, the shell tests for the scripts,
shellcheck, actionlint) → `translate` → `verify` → `deploy` (approved.rs) and
`deploy-brand-site` (details.rs, carlab.rs). Beside them, `shop-image` →
`deploy-shop` → `record-shop` ship the shop backend to its VPS (see
[the shop backend](#the-shop-backend-medusa-on-a-vps-apicarlabrs)), and
`deploy-brand-site` waits for `deploy-shop`, held back only if it _failed_. The
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
production untranslated. `verify` re-runs the tests on that SHA: `translate` pushes
as `GITHUB_TOKEN`, and such a push starts no new run — otherwise nobody would check
the translated tree.

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
change. The list is maintained by hand — if a new file starts affecting the build,
it has to be added there too. The rest of `.github/` is deliberately not tracked:
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
changed outside git: an environment variable or a project setting in the Vercel
dashboard, a Blob store rotation. Such edits require a rebuild but leave no trace in
the repository's history, and `scope` only looks at git.

`environment: production` on the deploy jobs is an ordinary GitHub Environment,
created by itself on the first run, with no protection rules.

### A consequence: environment variables live in the Vercel project

`vercel pull` downloads the project's production environment variables into
`.vercel/.env.production.local`, and `vercel build` builds with them. Which means:

- **variables are set in the Vercel dashboard, not in GitHub secrets.** GitHub only
  holds the token/IDs for reaching Vercel plus `OPENAI_API_KEY` for the
  `translate` job (see below);
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

Set in Vercel Dashboard → the project → Settings → Environment Variables (the
Production environment; Preview is unused — there are no preview deploys).

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

### Analytics — no environment variables

The GA4 measurement ids and the Meta Pixel id are baked into each
`src/utils/analytics.ts` and are never read from the environment: they are not
secrets, they are publicly visible in any request from the site, and spreading
them across three Vercel dashboards would create a third place to get them
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

On approved.rs, `PUBLIC_WHATSAPP_NUMBER` doubles as the number for an ordinary call
(`PHONE_NUMBER` there is an alias of it).

### Telegram (needed by all three projects)

Four bots, and the variables split along that line. The CRM bot `@SerbCRMBot` is
one bot shared by the three projects; each brand's capture bot is its own.

| Variable                             | approved.rs | carlab.rs | details.rs | Bot     | Without it                                                                     |
| ------------------------------------ | ----------- | --------- | ---------- | ------- | ------------------------------------------------------------------------------ |
| `TELEGRAM_BOT_TOKEN`                 | ✅          | ✅        | ✅         | CRM     | `/api/leads` and `/api/contact-click` answer 500                               |
| `TELEGRAM_BOT_USERNAME`              | ✅          | ✅        | ✅         | CRM     | the same — 500                                                                 |
| `TELEGRAM_GROUP_ID`                  | ✅          | ✅        | ✅         | CRM     | the same — 500                                                                 |
| `TELEGRAM_OWNER_ID`                  | ✅          | ✅        | ✅         | CRM     | this brand's leads never reach the owner's DMs                                 |
| `TELEGRAM_ADMIN_ID`                  | ✅          | ✅        | ✅         | CRM     | this brand's leads never reach the admin's DMs                                 |
| `TELEGRAM_WEBHOOK_SECRET`            | ✅          | —         | —          | CRM     | `/api/telegram-webhook` answers 401 to everything — the bot's buttons are dead |
| `TELEGRAM_CAPTURE_BOT_TOKEN`         | ✅          | ✅        | ✅         | capture | this brand's capture bot never answers a visitor and no lead is written        |
| `TELEGRAM_CAPTURE_WEBHOOK_SECRET`    | ✅          | ✅        | ✅         | capture | `/api/telegram-capture` answers 401 to everything — the Telegram tile is dead  |
| `TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB`  | optional    | —         | —          | capture | owner messages in a CarLab Topic are reported undelivered                      |
| `TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS` | optional    | —         | —          | capture | owner messages in a Details Topic are reported undelivered                     |

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
Set the same ids in all three projects.

The **CRM** bot is shared across brands: `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME` and `TELEGRAM_GROUP_ID` are identical in all three
projects, and `TELEGRAM_WEBHOOK_SECRET` is set only on approved.rs, which hosts
that one bot's webhook.

The **capture** bots are not. `TELEGRAM_CAPTURE_BOT_TOKEN` is `@ApprovedRsBot`'s
on approved.rs, `@CarLabRsBot`'s on carlab.rs and `@DetailsRsBot`'s on
details.rs — three different tokens from @BotFather, never copied between
projects: which bot received the update is what tells the server the brand, so a
shared token would hand a visitor the choice. `TELEGRAM_CAPTURE_WEBHOOK_SECRET`
is per project too, and on approved.rs it is a **different** value from
`TELEGRAM_WEBHOOK_SECRET` — the two webhooks there belong to two different bots
and do not share a secret. approved.rs additionally holds the other two capture
tokens as `TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB` and `TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS`:
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

| Variable                | approved.rs | carlab.rs | details.rs | Without it                                               |
| ----------------------- | ----------- | --------- | ---------- | -------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` | ✅ auto     | ✅ auto   | ✅ auto    | leads are not stored and the routes fail                 |
| `CRON_SECRET`           | ✅          | —         | —          | `/api/reminders` answers 401 — the digest never goes out |

### Shop Orders (ADR-0053)

| Variable                    | approved.rs | carlab.rs | details.rs | Without it                                                                                                 |
| --------------------------- | ----------- | --------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `SHOP_API_URL`              | ✅          | no        | no         | ✅/❌ on a `parts-order` Lead never completes or cancels its shop Order                                    |
| `SHOP_ORDER_OUTCOME_SECRET` | ✅ secret   | no        | no         | same                                                                                                       |
| `SHOP_LEAD_SECRET`          | no          | ✅ secret | no         | `/api/shop-orders` answers 401 to the shop, a shop cancel never marks a Lead lost, «Сделать кейс» gets 401 |

`SHOP_API_URL` is the shop's public API origin, `https://api.carlab.rs`. When
the bot marks a `parts-order` Lead ✅ it completes the Order, ❌ cancels it,
through `POST /hooks/carlab-orders/:id/outcome` with
`Authorization: Bearer $SHOP_ORDER_OUTCOME_SECRET`. That route is not under
`/admin`, so Caddy's admin basic_auth never sees it, and the secret can do
nothing but complete or cancel an Order. `SHOP_ORDER_OUTCOME_SECRET` is one
value set twice, on approved.rs and in the shop's `.env`
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

**Do not set `BLOB_READ_WRITE_TOKEN` by hand** — it appears on its own once the Blob
store is connected to the project (see the next section).

### Keystatic (needed by all three projects)

| Variable                           | Public  | Without it                               |
| ---------------------------------- | ------- | ---------------------------------------- |
| `KEYSTATIC_GITHUB_CLIENT_ID`       | no      | signing in to `/keystatic` fails in prod |
| `KEYSTATIC_GITHUB_CLIENT_SECRET`   | no      | the same                                 |
| `KEYSTATIC_SECRET`                 | no      | the same (it signs the session cookie)   |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | **yes** | the sign-in button leads nowhere         |

The values **differ** between the three projects — each site has its own GitHub App,
see the "Keystatic: three GitHub Apps" section. `KEYSTATIC_SECRET` is an arbitrary
random string, distinct per project.

### `SITE`

A special case: it does not need setting in the dashboard.

- the site's URL is hardcoded as `site:` in each app's `astro.config.mjs`, and that
  is where Astro fills `import.meta.env.SITE` from, which `src/utils/constants.ts`
  reads. A `SITE` environment variable does not affect that value — Astro inlines
  only `PUBLIC_*` and its own built-in keys into `import.meta.env`;
- each app's `vercel.json` additionally puts `env.SITE` into the functions' runtime,
  in case anything needs it;
- in practice, only the local `scripts/register-webhook.ts` reads
  `process.env.SITE` (from the `.env.local` handed to `--env-file`), and it is
  the host the webhook is registered against — so point it at the `.env.local`
  of the project that hosts that bot's webhook, which for a capture bot is that
  brand's own project.

Changing the domain means editing `site:` in `astro.config.mjs` and `env.SITE` in
`vercel.json`, not a dashboard variable.

---

## One Blob store shared by three projects

All three apps create the storage identically:

```ts
createVercelBlobStorage({ path: 'data/leads.json' });
```

The same key. So for every brand's leads to sit in one file — and they must,
because the bot and the cron live only in approved.rs and have to see all three
brands' leads — **there must be one store, connected to all three projects**.

1. Vercel Dashboard → Storage → Create → Blob (once, not one per project)
2. On the created store → Connect Project → connect all three projects
3. Each project then grows its own `BLOB_READ_WRITE_TOKEN` pointing at that same
   store

Never set `BLOB_READ_WRITE_TOKEN` by hand: a value copied from another project
easily drifts from the store, and some leads end up in a file the bot cannot see.

Brands are separated by the lead's `brand` field (`Approved.rs` / `CarLab` /
`Details`), stamped by the server. There is no per-brand file.

A second file in the same store does occur, though: `data/leads-unreadable.json`.
Records the schema stopped accepting — after a schema change, for instance — are
copied there. It appears by itself when such a record is met, and the admin gets a
Telegram message with the count and the name of the site that found it. **Nothing is
deleted** from `data/leads.json` in the process: the records stay where they are
until someone sorts them out by hand. Nothing ever disappears from the blob
automatically.

`data/ledger.json` is the third file: the Balance. It appears on the first Lead
write after the release that introduced it, opened with whatever the old
records said the owner still owed, and the same write drops those old money
fields from `data/leads.json`. So that release needs three things around it —
a backup of `data/leads.json` before it deploys, a check that `data/ledger.json`
exists and «💶 Мне должны» matches the old «🔴 Мне должны» after the first Lead
write, and the expectation that the first digest lists every open Lead untouched
for 7+ days, every capture-bot `/start` Lead included — only a placeholder
Contact click retires itself as a Ghost lead. Steps 1 and 8 of
[`crm-bot-migration.md`](crm-bot-migration.md) walk through them.

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
   `KEYSTATIC_SECRET` of its own into the corresponding Vercel project

Local development does not go through the GitHub App: `import.meta.env.PROD` is
`false` there and Keystatic writes straight into the working copy
(`storage: { kind: 'local' }`).

`PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` must not be marked Sensitive in Vercel: such
variables are unavailable at build time, and the slug is needed by the `/keystatic`
client bundle. The three secrets, conversely, should be Sensitive — only the
function reads them.

A site without these variables builds, deploys and serves every page; only signing
in to `/keystatic` is dead, and only once somebody tries — carlab.rs and details.rs
lived that way for twelve days. To check by hand:
`curl -o /dev/null -w '%{http_code}' https://<domain>/api/keystatic/github/login`
— it should be 307, not 500.

---

## GitHub Actions secrets

Settings → Secrets and variables → Actions:

| Secret                              | For what                                       | Where to get it                                                |
| ----------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `OPENAI_API_KEY`                    | the `translate` job (content auto-translation) | OpenAI. **GitHub only, not needed on Vercel**                  |
| `VERCEL_TOKEN`                      | every deploy job                               | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID`                     | every deploy job                               | `.vercel/project.json` → `orgId` after `vercel link`           |
| `VERCEL_PROJECT_ID`                 | the approved.rs deploy                         | Project Settings → General of that project                     |
| `VERCEL_PROJECT_ID_AUTO_SERVICE`    | the carlab.rs deploy                           | the same, on the carlab.rs project                             |
| `VERCEL_PROJECT_ID_DETAILING`       | the details.rs deploy                          | the same, on the details.rs project                            |
| `AUTO_SERVICE_SHOP_VPS_HOST`        | the shop deploy (the server's static IPv4)     | Lightsail console → Networking                                 |
| `AUTO_SERVICE_SHOP_VPS_USER`        | the shop deploy                                | `deploy` (created by `bootstrap-host.sh`)                      |
| `AUTO_SERVICE_SHOP_VPS_SSH_KEY`     | the shop deploy (CI's private key)             | `ssh-keygen -t ed25519`; the public half gets `restrict`       |
| `AUTO_SERVICE_SHOP_VPS_KNOWN_HOSTS` | the shop deploy (the host key)                 | `ssh-keyscan -t ed25519 <IPv4>`, fingerprint verified apart    |

`AUTO_SERVICE_SHOP_VPS_*` are **repository** secrets, not `production` environment
secrets: `shop-image` has no environment, and with environment secrets it would not
push the image while `deploy-shop` would try to pull a tag that does not exist.
Until all four are set, `shop-image` does not push and `deploy-shop`'s `guard` step
prints "`AUTO_SERVICE_SHOP_VPS_* secrets are not set, skipping the shop deploy.`", and the
workflow stays green.

> **Careful: an unset `VERCEL_PROJECT_ID_*` is not highlighted anywhere.** The
> `guard` step in `deploy-brand-site` checks that the secret is non-empty, and if it
> is empty it **skips every remaining step and leaves the job green**. In Actions
> that looks like a successful deploy; the `guard` log will carry the line
> "`VERCEL_PROJECT_ID_… is not set — skipping the … deploy`". The only way to notice
> is to read the log, or to see that nothing changed on the site. approved.rs has no
> such guard: without `VERCEL_PROJECT_ID`, the `deploy` job fails honestly at
> `vercel pull`.
>
> The check lives in a step rather than in the job's `if:` because the `matrix`
> context is unavailable in a job-level condition.
>
> With the `deployed/*` tags, `guard` has a second and entirely normal reason to
> skip a deploy: "`<app> is current in production — skipping`" — the site has not
> changed since the last ship. That is it working, not a broken configuration. Tell
> them apart by the text in the `guard` step's log: "is not set" is a configuration
> error, "is current in production" is by design.

### Job permissions

`GITHUB_TOKEN` is granted per job rather than for the whole file. Four jobs hold
`contents: write`, for two different reasons:

| Job                 | `permissions`                       | Why exactly that much                                                                        |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `check`             | `contents: read`                    | checkout only                                                                                |
| `translate`         | `contents: write`                   | commits and pushes translations into the same branch                                         |
| `verify`            | `contents: read`                    | a checkout with `fetch-depth: 0`; the `deployed/*` tags arrive with the history              |
| `shop-image`        | `contents: read`, `packages: write` | pushes `ghcr.io/zikrasoft/podbor-auto-service-shop:<sha>` to GHCR                            |
| `deploy-shop`       | `contents: read`, `packages: read`  | hands the server a one-shot token for `docker pull`; that token cannot write to the repo     |
| `record-shop`       | `contents: write`                   | moves `deployed/auto-service-shop` after a successful `deploy-shop`, a separate job for that |
| `deploy`            | `contents: write`                   | moves `refs/tags/deployed/approved-rs` after a successful deploy                             |
| `deploy-brand-site` | `contents: write`                   | the same for `deployed/detailing` and `deployed/auto-service`                                |

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
between `vercel build` executes the repository's code — there is no reason to leave
it a write-capable token recorded in `.git/config`.

Two traps, both of which look like "the Vercel secrets broke" while having nothing
to do with them:

- Settings → Actions → General → Workflow permissions must be **Read and write**.
  With "Read repository contents", both `translate` and the tag step fail, with
  "Resource not accessible by integration".
- Tag protection rules must not cover `deployed/*`. If they do, the site ships and
  the job goes red afterwards: the tag stays old, and the next run ships the same
  site again.

---

## The shop backend: Medusa on a VPS (`api.carlab.rs`)

`apps/auto-service-shop` is not on Vercel. It is docker compose on a single AWS Lightsail
instance (Linux/Unix, Ubuntu 24.04, the 4 GB bundle: 2 vCPU, 80 GB SSD, 4 TB
transfer, $24 a month), in the same region as the shop's S3 buckets, all
described in `infra/auto-service-shop/`:

| File                                     | What it is                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile` + `Dockerfile.dockerignore` | the production image: `pnpm --filter @podbor/auto-service-shop build`, `pnpm deploy --legacy`; runtime from `.medusa/server` as `node`                               |
| `docker-compose.yml`                     | postgres 16.15, typesense 30.2, medusa (the GHCR image by sha), caddy 2.11.4                                                                                         |
| `caddy/Caddyfile`                        | `api.carlab.rs` and `admin.carlab.rs` → `medusa:9000`, TLS, security headers, body up to 25 MB, basic_auth on the admin host                                         |
| `production.env.example`                 | the template for `/srv/carlab/.env`                                                                                                                                  |
| `backup.env.example`                     | the template for `/srv/carlab/.env.backup`, the off-host backup bucket                                                                                               |
| `deploy.sh`, `backup.sh`, `restore.sh`   | shipping, the nightly backup and its off-host copy (`backup.sh fetch` pulls one back), restore                                                                       |
| `crawler-role.sh`                        | the crawler's Postgres role, run by `deploy.sh` and `restore.sh` after the migrations                                                                                |
| `move-static-to-s3.sh`                   | once: copies the old `static` volume to the public bucket and rewrites the stored image URLs                                                                         |
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
`crawl_page`, with the object key in `crawl_page.body_key`); the gzipped HTML goes
to the private S3 bucket. Requests go through Crawlee with browser-like headers and rotating
sessions; a site marked `fetchMode: 'browser'` (FILTRON, behind Cloudflare) loads
its pages in Playwright's own headless Chromium, while robots.txt and sitemaps
stay plain HTTP. A page the site keeps blocking after Crawlee's retries is marked
failed with its reason in the admin; five such pages in a row pause the crawl, as do
an unreachable robots.txt or sitemap and five server errors in a row. Pressing the
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

Postgres has no host port and sits on the internal `data` network at a fixed
address, `10.200.0.10` (`ipv4_address` in `docker-compose.yml`, subnet
`10.200.0.0/24`), so the worker reaches it through an SSH tunnel as the `crawler`
user. `harden-ssh.sh` creates that user with no shell and an sshd
`Match User crawler` block: local forwarding to `10.200.0.10:5432` and nothing
else, no TTY, no command, no remote listening. Everyone else, `deploy` and CI's
key included, keeps `AllowTcpForwarding no`. Checked by
`infra/auto-service-shop/test/harden-ssh.test.sh`.

Once, on the Mac, make a key for the tunnel and copy its public half, with the
script, to the Lightsail server. The private key never leaves the Mac:

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

### The server

- `/srv/carlab/`: CI places `docker-compose.yml`, `caddy/Caddyfile` and the scripts
  there on every deploy; `.env` (mode 600) is written by hand once;
  `.previous-tag` holds the previously shipped sha, for rollback. After a successful
  ship, `deploy.sh` deletes shop images other than the current one and
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
  [Backup and restore](#backup-and-restore)) and Lightsail's automatic snapshots of
  the whole instance, switched on when it is created.
- **Typesense is not backed up.** Its index is derived from Postgres and rebuilt by
  the reindex at every Publish (ADR-0041), so after a restore search stays empty
  until the next Publish.
- Only Caddy is published outward: 80, 443, 443/udp. Medusa, Postgres and Typesense
  have no host ports; Postgres and Typesense sit on an internal network with no
  route to the internet, and the storefront reaches search only through Medusa's
  store routes. Checked by `infra/auto-service-shop/test/compose.test.sh`.
- IPv6 reaches Caddy directly: the `edge` network is dual-stack (`enable_ipv6`, ULA
  `fd00:ca7:1ab::/64`) and `userland-proxy` is disabled in `daemon.json`. Never turn
  the userland proxy back on, or every IPv6 client becomes the docker gateway's
  address.
- Memory limits for 4 GB: medusa 1536m (a 1024 MB Node heap), typesense 768m,
  postgres 512m, caddy 128m, 2944 MB together, under 3 GB (checked
  by the compose test). The crawler runs on the owner's Mac, so it is not in the budget.
  Typesense holds its whole index in memory; measure it with
  `docker stats --no-stream` once the catalogue is at scale, and raise the limit
  before the index outgrows it.

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
  `crawl/<site>/<sha256 of the URL>.html.gz`. The import reads them back from there.

Bucket setup: keep Object Ownership on "Bucket owner enforced" (ACLs off; the file
provider runs with `acl: false`), and make the public bucket readable with a
bucket policy granting `s3:GetObject` on `arn:aws:s3:::<public bucket>/*` to
everyone; the private bucket stays fully blocked. Lightsail has no instance role
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
keys through a temporary env file) and rewrites `https://$API_HOST/static` to
`FILE_URL` in `part_identifier.images` and `category.image`. File ids keep working
because the keys stay the file names. Then a Publish, and `docker volume rm
carlab_static` once the images show.

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
- `DATABASE_URL` and the `TYPESENSE_HOST`/`PORT`/`PROTOCOL` are not written into
  `.env`: compose assembles them from the service names, `POSTGRES_PASSWORD` and
  `TYPESENSE_API_KEY`, and hands the same key to Typesense itself.
- `OPENAI_API_KEY` and `PUBLISH_DISPATCH_TOKEN` feed the admin's Publish chain:
  the first translates catalogue text, the second is a fine-grained GitHub token
  with `actions: write` on this repository that dispatches `publish.yml` and
  then reads that run until it finishes (`write` includes `read`). Search is
  reindexed only after the run succeeds; a failed or cancelled run, or one
  still unfinished after 90 minutes, stops the chain at the deploy step. Either
  may stay empty; the chain then stops at that step and the admin shows why.
  `publish.yml` rebuilds carlab.rs from the `deployed/auto-service` tag, so it
  ships fresh catalogue data and never code that is not live yet. The chain runs
  only from the admin's Publish button, in the top bar of every admin page.
  **Accepted risk:** the token sits in `/srv/carlab/.env` in plain text, and
  `actions: write` lets whoever reads it dispatch or cancel any workflow in this
  repository, not only `publish.yml`, since a fine-grained token cannot be
  narrowed to one workflow. Only `deploy` (and root) can read that file, and a
  dispatched workflow runs the repository's own code at a ref that is already
  pushed, so the token cannot ship code that is not in the repository. Give it
  the shortest expiry you are willing to rotate, and revoke it at
  Settings → Developer settings at the first sign the server is compromised.
- `OPENAI_API_KEY` also answers a Supplier Import's one question per new
  article (Russian name, Category, attributes, description), on
  `OPENAI_IMPORT_MODEL` (empty means `gpt-4o-mini`). Answers are cached in the
  private bucket under `ai-answers/`, keyed by prompt, model and article, so a
  rerun or a rebuilt database asks nothing twice; changing the model or the
  prompt asks again. An answer that fails validation twice is cached as a
  failure too and listed in the Import report, so a rerun does not pay for it
  again. Without S3 nothing is cached. `IMPORT_CONCURRENCY` (empty means 4) is
  how many articles are asked at once; vehicle fitting still runs one article
  at a time. An answer's attributes that do not fit its Category are dropped one
  by one; a Part whose answer still misses a required field stays without a
  Category, and the report names the Category and the missing fields.
- `ADMIN_BASIC_AUTH_USER` and `ADMIN_BASIC_AUTH_HASH` put HTTP basic_auth in
  front of everything on `ADMIN_HOST`, before Medusa's own login, so staff
  passwords cannot be guessed from the internet. The hash is bcrypt, made
  without printing the password to the terminal history:
  `docker run --rm -it caddy:2.11.4-alpine caddy hash-password` (it prompts).
  Write it in **single quotes**, `ADMIN_BASIC_AUTH_HASH='$2a$14$...'`, or compose
  substitutes its `$` signs. Both are required: compose refuses to start without
  them. Three requests on the admin host pass with a `Bearer` token alone, since
  the admin's own fetch replaces the browser's basic_auth header there:
  `/auth/session` (sign-in), `/admin/invites/accept` and
  `/auth/user/emailpass/update` (a password reset); each one is refused by Medusa
  without a valid token, and staff sign-in itself (`/auth/user/emailpass`) is
  not among them. The API host answers 404 on `/admin` and `/auth/user`, so
  staff routes exist only behind the admin host's basic_auth; the storefront
  calls only `/store/*` (and the `/health/ready` probe). Checked against a live Caddy by
  `infra/auto-service-shop/test/compose.test.sh`.
- `CRAWLER_DB_PASSWORD` is the crawler's Postgres password, see
  [The crawler on the owner's Mac](#the-crawler-on-the-owners-mac).
  There is no nightly run: cart and checkout quote price and stock live, and a
  build bakes the prices current at that moment into the pages' structured data.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_ID` are the CRM bot's own values: when an order's Lead still has not reached the storefront after the last retry, the shop posts an alert to that group. Empty, the failure only reaches the log.
- `ADMIN_HOST` is where staff open the admin (`admin.carlab.rs`): Caddy proxies it to the same Medusa, sends `/` to `/app`, and redirects `api.carlab.rs/app` there. `ADMIN_CORS` and `AUTH_CORS` name that origin; the admin calls the API on its own origin, so `admin.backendUrl` stays unset.
- `LEAD_ROUTE_URL` is the storefront's `/api/leads` URL, and its origin is where a placed order goes:
  the `order.placed` subscriber posts it to `/api/shop-orders` on that origin as
  a `parts-order` Lead, which reaches Telegram like every other Lead. The full
  `/api/leads` URL is only the fallback for a storefront too old to serve
  `/api/shop-orders` (it answers 404); once that fallback is dropped (the
  `TODO:` in `order-lead.ts`) the value becomes the bare origin. Empty, orders are placed but reach
  nobody, and the log says so. A delivered order is stamped
  `lead_handed_off_at`; every 10 minutes `src/jobs/retry-order-leads.ts`
  re-sends each order from the last two days (older than two minutes) that
  lacks the stamp, six attempts in all, timeouts included. That also catches
  an `order.placed` event lost to a restart, since the event bus lives in
  memory. A re-send cannot make a second Lead: the post carries `order_id`, and
  the lead store answers a known order with the Lead it already made. The last
  failed attempt is reported to the CRM group through `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_GROUP_ID`, the same names and values as the CRM bot's on Vercel.
  Both are optional; unset, the failure is only logged.
- `VIN_DECODERS` is the VIN decoder chain, comma-separated, in the order they
  are tried. An unknown name stops the server at startup.
- `TYPESENSE_API_KEY` has a local default only outside production; with
  `NODE_ENV=production` an empty one stops the server at startup.
- `FILE_URL` is the public base URL of the public bucket, stored into every image
  URL at upload time: `https://<bucket>.s3.<region>.amazonaws.com` now, a
  CloudFront or Lightsail CDN address later (only new uploads pick a change up;
  stored URLs need the same rewrite `move-static-to-s3.sh` does). Without it
  production stops at startup.
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
- Never print the file. Read a single value with `sed -n 's/^NAME=//p'` into a
  variable, or list names only: `cut -d= -f1 /srv/carlab/.env`.

### Closed beta: the preview flag

The parts catalogue is public and indexable, but buying is closed until both
sides say otherwise. Two variables, one per side:

| Variable    | Where                                             | Closed (default)                                                                                                                                                                                                          | `true`                       |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `SHOP_OPEN` | carlab.rs Vercel project (Production), build time | pages carry no price, no Offer JSON-LD, no add-on price, no cart link; every part asks «Узнать цену»; search drops prices and the price filter; llms.txt names no cart                                                    | prices and cart for everyone |
| `SHOP_OPEN` | `/srv/carlab/.env` on the shop VPS                | without the preview header, `POST /store/offer-carts`, `/store/offer-carts/:id/items` and `/store/offer-carts/:id/complete` answer 403, and every store route answers with no offers, no add-on price and no price filter | anyone may buy               |

On carlab.rs only the exact value `true` opens the shop: unset or anything else
is closed. turbo passes `SHOP_OPEN` through to the `@podbor/auto-service`
build, so a rebuild (`publish.yml` or a deploy) is what applies a change. An
open build sends the preview header itself, so it builds with prices even if
the backend is still closed.

A closed-beta tester opens any carlab.rs page with `?dev=1`. The browser keeps
the `auto_service_shop_preview=1` cookie for a year, until a page is opened with
`?dev=0`. With the flag the visitor sees the shop as it will look open: the
header and the parts index show the cart; listings, car and model pages, kits
(with their «в корзину» button), add-on prices and the price filter on static
pages are filled after load by one `POST /{locale}/parts/prices/` per page,
which renders the same components with prices; a part page fetches its offers
live from `/api/part-offers`; search renders prices and the price filter on the
server; the cart and checkout work. carlab.rs reads the cookie (or `?dev=1` on
the request itself) and passes `x-shop-preview: 1` to Medusa. Without the flag,
`/parts/cart/` redirects to the inquiry form and nothing above runs.

This is a soft gate for a closed beta, not security. Anyone who learns `?dev=1`
can buy and see prices, and anyone can send `x-shop-preview: 1` to the store
API. Open the shop by setting `SHOP_OPEN=true` on both sides, restarting the
backend (`deploy.sh` or `docker compose up -d medusa`) and rebuilding
carlab.rs.

### How it ships

1. `shop-image` builds the image from the SHA after `translate`, migrates an empty
   database on the CI runner (`apps/auto-service-shop/docker-compose.test.yml`) with it,
   and boots it to `healthy`. On branches that is all. On `main`, and only if
   `auto-service-shop` is in the `scope` list, it pushes
   `ghcr.io/zikrasoft/podbor-auto-service-shop:<sha>`, and only when all four
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
   the production seed in another (`medusa exec ./src/scripts/seed-production.js`,
   see below); only after both succeed does `MEDUSA_TAG` in `.env` change, with the
   old one going to `.previous-tag`; `up -d --wait`; `caddy reload`; then checks
   `https://api.carlab.rs/health/ready`. It prints stage names and the tag, never a value
   from `.env` (`infra/auto-service-shop/test/scripts.test.sh` plants a canary secret and
   fails if any script prints it).
4. `record-shop` moves `deployed/auto-service-shop` only if `deploy-shop` actually shipped
   the image (`outputs.deployed == 'true'`).
5. `deploy-brand-site` waits for `deploy-shop` and is held back only if it failed, so
   carlab.rs never prerenders against a backend that failed to ship. approved.rs
   does not wait: it does not read the shop. Right after `vercel pull` the
   carlab.rs leg probes `MEDUSA_BACKEND_URL/health`
   (`.github/scripts/shop-backend-up.sh`, a few retries over about 20 seconds).
   If the backend does not answer, the leg prints a `::warning::`, skips the
   build and the deploy, and leaves `deployed/auto-service` where it was, so the
   live site keeps serving the last build and the next run retries. Without the
   probe, a VPS outage would fail every carlab.rs deploy, since the storefront
   build throws when the backend it is pointed at is unreachable. The Publish
   workflow runs the same probe but fails instead (`::error::`), so the admin
   shows the Publish as failed rather than as done.

   The build reads the catalogue once (pages, sitemap and llms.txt share it)
   and records how many part pages it serves at
   `https://carlab.rs/catalogue-build.json`. A `vercel build` (it sets
   `VERCEL=1`) reads that record from the live site first, and once it counts
   any part pages the catalogue is live: the build then fails without
   `MEDUSA_BACKEND_URL`, on zero part pages, and on fewer than half of what the
   live site serves. A shrink that is meant (a supplier removed) goes through
   with `CATALOGUE_SHRINK_ALLOWED=true` in the carlab.rs Vercel project for one
   build; remove it afterwards. Part pages list only published numbers, the same
   ones search finds, so a CI deploy and a Publish build the same catalogue.

The production seed (`apps/auto-service-shop/src/scripts/seed-production.ts`) runs on
every deploy and is idempotent. It creates the cash-at-pickup commerce defaults
(store, the `CarLab parts shop` sales channel, the Serbia region), the seven
Categories carlab.rs's old `/{locale}/parts/{slug}/` pages 301 to, with their
Russian name and text and the old picture from `apps/auto-service-shop/assets/categories`
(the image copies that directory to `/server/assets`), and «Аккумуляторы»
(`batteries`) with its nine fields, their options and the battery registration
service (label, price, note), from the same definitions the demo seed uses.
Batteries ship without a picture: upload one in the admin. Serbian and English
come from the admin's Publish chain like any other catalogue text. A Category,
field or option a person has edited (`updated_by` set) is never touched again; an
unedited one gets its seeded values and missing image back.

It also configures the crawled catalogues, from `CRAWLED_CATALOGUES` in
`apps/auto-service-shop/src/lib/production-seed.ts`, one entry per crawled site: the
Supplier (with cross-references, applicability and images released), its Brands with the spelling the site prints (MANN-FILTER, FILTRON,
VARTA, and febi, SWAG and Blue Print for bilstein group), its known category
mapping (VARTA `battery` to «Аккумуляторы») and, for the three sites that list cars,
every Make alias of the car Make table `CAR_MAKES` in
`apps/auto-service-shop/src/lib/suppliers/makes.ts` (`SKODA` on Škoda, `VOLVO CARS` on
Volvo, `VW (VOLKSWAGEN)` on Volkswagen, ...). The
same `updated_by` rule holds for each of these rows. A Brand or Make is found by
its name, then its slug, then the seeded spelling that points at it, so a staff
rename of either does not seed a duplicate. Deleting a spelling or a mapping in
the admin is a soft delete, and the seed reads a deleted row as the staff's
decision and leaves it deleted. Every other site category is still mapped by
hand on the Supplier's categories screen.

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
data. The shop's own migrations stay additive for the same reason (AGENTS.md). After a manual rollback the
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

### Checking the stack locally

The same compose comes up on your own machine with no separate override, through
variables in `infra/auto-service-shop/.env` (covered by `.gitignore`'s `.env`):
`API_HOST=localhost`, `HTTP_PORT=8080`, `HTTPS_PORT=8443`,
`MEDUSA_IMAGE=podbor-auto-service-shop`, `MEDUSA_TAG=local`, plus the secrets. The image
comes from `docker build -f infra/auto-service-shop/Dockerfile -t podbor-auto-service-shop:local .`.
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
  Never add `ports:` to another service in the compose stack. Lightsail's own
  firewall sits in front of the instance and does filter it, so it must allow
  exactly 22/tcp, 80/tcp, 443/tcp and 443/udp, on the IPv4 and the IPv6 firewall
  alike (they are two separate lists in the Networking tab).
- **Use the static IP everywhere.** A Lightsail instance without a static IP gets a
  new public IPv4 on every stop and start. Attach one before writing DNS records or
  `AUTO_SERVICE_SHOP_VPS_HOST`; it is free while attached and billed once detached.
- **The browser SSH console stops working after hardening.** Lightsail's
  "Connect using SSH" logs in as `ubuntu`, and `harden-ssh.sh` allows only `deploy`
  and `crawler`. Keep a working `deploy` key; if it is lost, recover through a
  snapshot rather than the console.
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
- **The backup cron runs in the host's timezone**, UTC on Lightsail's Ubuntu image
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

1. **Lightsail.** Create the instance in the shop's region: Linux/Unix, OS only,
   Ubuntu 24.04 LTS, the $24 bundle (4 GB, 2 vCPU, 80 GB SSD), dual-stack (IPv4 +
   IPv6), with your own ssh key pair uploaded rather than Lightsail's default one.
   Then:
   - Networking: create a static IP and attach it to the instance.
   - Networking, both the IPv4 and the IPv6 firewall: keep SSH 22/tcp and HTTP
     80/tcp, add HTTPS 443/tcp and a custom rule for 443/udp (HTTP/3).
   - Snapshots: turn on automatic snapshots.

   Done: the instance shows the static IPv4, an IPv6 address, the four firewall
   rules on both lists and automatic snapshots on.

2. **Bootstrap.** Log in as `ubuntu` with your key, upload
   `infra/auto-service-shop/bootstrap-host.sh` and `infra/auto-service-shop/harden-ssh.sh`, and
   run `sudo sh bootstrap-host.sh`: it gives `deploy` the keys of the user who ran
   `sudo`. Open a separate session, `ssh deploy@<IPv4>`, and **keep it open** until
   key-based login has been re-verified after hardening. From it, run
   `harden-ssh.sh` **through `sudo`** (with the crawler's public key, see
   [The crawler on the owner's Mac](#the-crawler-on-the-owners-mac), or without it
   for now).
   Done: `ssh deploy@<IPv4>` lets you in by key; `ssh ubuntu@<IPv4>` and
   `ssh root@<IPv4>` refuse.
3. **DNS.** A records for `api.carlab.rs` and `admin.carlab.rs` at the static IPv4,
   AAAA records at the instance's IPv6. If IPv6 does not work at the host or on the
   network, remove the AAAA records.
   Done: `dig +short` and `dig +short AAAA` return them for both names.
4. **`.env` on the server.** Copy `infra/auto-service-shop/production.env.example` to
   `/srv/carlab/.env`, fill in every value (secrets with `openssl rand -hex 32`,
   the admin's basic_auth hash as in [`.env`](#env)), then
   `chmod 600 /srv/carlab/.env`. Give staff the basic_auth user and password
   apart from their Medusa sign-in.
   Done: `ssh deploy@<IPv4> 'stat -c %a /srv/carlab/.env'` prints `600`.
5. **Shop buckets.** Create the public and the private S3 bucket and the shop's
   IAM user as in [Files on S3](#files-on-s3), and put their values in
   `/srv/carlab/.env`. Create the crawler's IAM user with the private-bucket
   policy there too; its key goes only to the Mac's `.env.crawler`.
   Done: `cut -d= -f1 /srv/carlab/.env | grep '^S3_'` lists the five required names.
6. **Backup bucket.** Create a private AWS S3 bucket in another region than the
   instance (or at Backblaze B2 or Cloudflare R2) and an IAM user whose key is
   limited to that bucket, separate from the shop's.
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
   Then open «Аккумуляторы»: the production seed created it with its nine
   fields, their options and the battery registration service (label, price,
   note). Check the price is still right and upload the Category's picture,
   which the seed does not ship.
   The crawled Suppliers, their Brands and spellings, the VARTA battery mapping
   and the Volkswagen aliases are seeded too: nothing to set up before the first
   crawl and Import.
   Done: signing in works, the eight seeded Categories are in the admin,
   «Аккумуляторы» shows its fields, the registration service and a picture, and
   the Suppliers screen lists the four crawled sites.
10. **The shop's `.env` values for carlab.rs.** In `/srv/carlab/.env`:
    `LEAD_ROUTE_URL=https://carlab.rs/api/leads` (orders go to `/api/shop-orders`
    on its origin, see [`.env`](#env)), `SHOP_OPEN=false` while the shop is
    closed, `PUBLISH_DISPATCH_TOKEN` and `OPENAI_API_KEY` as described in
    [`.env`](#env); `docker compose up -d medusa` after editing.
    Done: `cut -d= -f1 /srv/carlab/.env` lists all four names.
11. **carlab.rs on Vercel.** In the carlab.rs project (Production):
    `MEDUSA_BACKEND_URL=https://api.carlab.rs`, `MEDUSA_PUBLISHABLE_KEY` = the key
    from step 9, and `SHOP_OPEN` **unset** until the shop opens. Then press Publish
    in the admin so the Categories get their Serbian and English text and carlab.rs
    rebuilds against the catalogue.
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

## Creating a new project in Vercel

For a new site (this is how all three were set up):

1. Vercel → Add New → Project → Import Git Repository → the same
   `Zikrasoft/approved_rs` repository
2. **Root Directory** → leave it empty (`./`), despite Vercel prefilling the app's
   path from the import screen. GitHub Actions does the deploying and the job
   already runs inside `apps/<app>`; if the project adds its own Root Directory on
   top, the CLI will look for `apps/detailing/apps/detailing` and `vercel deploy`
   will fail with "The provided path … does not exist". The build stays green — only
   the deploy step breaks. The approved.rs project is configured the same way
3. Framework Preset: **Astro**. Leave Build/Install/Output Command alone — they are
   already set in the app's `vercel.json` and will override the dashboard
4. Environment Variables — per the tables above (public contacts, Telegram,
   Keystatic). They can be added right on the import screen
5. Deploy — Vercel does the first build itself; it only exists to bring the project
   to life. After that GitHub Actions deploys
6. Settings → Domains → add `carlab.rs` (or `details.rs`) and set the DNS at the
   registrar per Vercel's instructions
7. Storage → connect **the same** Blob store approved.rs uses
8. Settings → General → copy the Project ID into the GitHub secret
   (`VERCEL_PROJECT_ID_AUTO_SERVICE` / `VERCEL_PROJECT_ID_DETAILING`)

There is no need to disable the git trigger in the dashboard —
`git.deploymentEnabled: false` in the root `vercel.json` does it.

---

## The order for setting up a new site

First the Vercel project with its domain and variables, the shared Blob store, the
GitHub App for Keystatic and the Project ID in the secrets — and only then the first
deploy. A deploy started before the project has its variables will build
successfully and ship a site with `undefined` in the contacts and a form that fails.
The first run without a `deployed/<app>` tag deploys the app unconditionally and
creates the tag; after that, a green run with no deploy at all is the normal state.

---

## Content auto-translation

Case studies (`src/content/cases`, `works`, `products`) and UI copy
(`src/content/i18n/*.yaml`) are translated automatically. The admin in Keystatic
writes only the Russian fields — none of the four languages under `translations` is
required there, because Keystatic cannot make an API call from its own form, so a
"Translate" button cannot exist there in principle.

In its place there is the `translate` job in `.github/workflows/ci.yml`: on every
push (**to any branch**, not only `main`) it walks every `apps/*/` and runs each
script it finds (`translate-cases`, `translate-works`, `translate-i18n`), then
commits the result back — so the translations are already in the feature branch by
the time it is merged, rather than appearing only afterwards.

This is safe to run on every branch: `git.deploymentEnabled` is now `false`
throughout and Vercel no longer deploys on a git push for any branch — a translation
commit on a feature branch cannot possibly start a surplus build. On `main` the
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

Two kinds, and only the CRM one is approved.rs-only.

- **`/api/telegram-webhook`** — `@SerbCRMBot`, the CRM bot. One bot, so one
  webhook, and it lives in approved.rs; carlab.rs and details.rs have no such
  route. Its `secret_token` is approved.rs's `TELEGRAM_WEBHOOK_SECRET`.
- **`/api/telegram-capture`** — the brand's own capture bot, in **all three**
  projects. `@ApprovedRsBot` is registered against `approved.rs`, `@CarLabRsBot`
  against `carlab.rs`, `@DetailsRsBot` against `details.rs`, each with that
  project's `TELEGRAM_CAPTURE_WEBHOOK_SECRET`
  ([ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).

Each is registered once per bot, four registrations in total.

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
in Vercel Blob (`data/leads.json`, private access), with no external database.

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

The webhook must carry a `secret_token` equal to the approved.rs project's
`TELEGRAM_WEBHOOK_SECRET` — without a match the endpoint answers 401 to every
request:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://approved.rs/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
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
bot or a missing variable exits non-zero without calling Telegram:

```bash
cd apps/approved-rs
node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts crm
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
node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts capture
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

## The reminder cron (approved.rs only)

`apps/approved-rs/vercel.json`:

```json
"crons": [{ "path": "/api/reminders", "schedule": "0 8 * * *" }]
```

Every day at 08:00 UTC, Vercel calls `/api/reminders` with
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

The cron belongs to a project, not to the bot: the other two projects have no
`crons` section in `vercel.json` and do not need one — otherwise the same reminders
would go out several times over.

---

## A custom domain

1. Vercel Dashboard → the project → Settings → Domains
2. Add the domain (`approved.rs` / `carlab.rs` / `details.rs`)
3. Set the DNS records (A or CNAME) at the registrar per Vercel's instructions
4. Check that `site:` in that app's `astro.config.mjs` and `env.SITE` in its
   `vercel.json` match the domain — the canonical links, the sitemap and the OG tags
   all depend on them

---

## pnpm on Vercel

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

Additionally for approved.rs:

- [ ] The buttons in the bot's DM work (meaning the webhook and
      `TELEGRAM_WEBHOOK_SECRET` match)
- [ ] All three brands' leads are visible to the bot (meaning the Blob store really
      is shared)
- [ ] The geo banner appears when arriving from DE/RS/ES (VPN)
