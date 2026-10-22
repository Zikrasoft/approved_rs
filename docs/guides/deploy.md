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
| `apps/auto-service` | `carlab.rs`   | CarLab — auto service          | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`                                                   |
| `apps/detailing`    | `details.rs`  | Details — detailing            | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`                                                   |

Each app owns its own `astro.config.mjs`, `vercel.json`, `keystatic.config.ts` and
`.env*`. The Vercel CLI identifies the project from the working directory, so every
deploy job runs entirely from its own `apps/<app>`.

**Four bots, one chat, one lead store, three brands.** `@SerbCRMBot` is the CRM
bot — cards, statuses, money, postpone and reminders — and it is the same bot
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

| What `scope` sees                                                  | Decision |
| ------------------------------------------------------------------ | -------- |
| the `deployed/<app>` tag does not exist yet                        | deploy   |
| the tag is not an ancestor of `HEAD` (force-push, branch rollback) | deploy   |
| a root build file changed (list below)                             | deploy   |
| `turbo --filter="...[<tag>]"` names the package as changed         | deploy   |
| turbo failed, or its output could not be parsed                    | deploy   |
| `apps/carlab-shop`: something under `infra/carlab-shop/` changed   | deploy   |
| turbo affirmatively said the package is not among the changed ones | skip     |

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
`setup-pnpm` installs the whole workspace in every job — until that measurably
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

| Variable                 | approved.rs | carlab.rs   | details.rs  | Default in the schema        | Without it                   |
| ------------------------ | ----------- | ----------- | ----------- | ---------------------------- | ---------------------------- |
| `PUBLIC_WHATSAPP_NUMBER` | ✅ required | ✅          | ✅          | none / `PUBLIC_PHONE_NUMBER` | the build fails / the phone  |
| `PUBLIC_VIBER_NUMBER`    | ✅ required | ✅          | ✅          | none / `PUBLIC_PHONE_NUMBER` | the build fails / the phone  |
| `PUBLIC_PHONE_NUMBER`    | —           | ✅ required | ✅ required | none                         | the build fails              |
| `PUBLIC_THREADS_CHANNEL` | ✅ required | —           | —           | none                         | the build fails              |
| `PUBLIC_INSTAGRAM`       | —           | —           | ✅          | none (optional)              | the Instagram tile is hidden |
| `PUBLIC_TG_MANAGER`      | ✅          | ✅          | ✅          | none (optional)              | see below                    |

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

| Site        | GA4 Measurement ID | Meta Pixel          | Google Ads       |
| ----------- | ------------------ | ------------------- | ---------------- |
| approved.rs | `G-KRZTP1VX7D`     | —                   | —                |
| carlab.rs   | `G-DNDDCQWYRR`     | `29229430643330595` | `AW-18508613563` |
| details.rs  | `G-XH3F0PZNCC`     | —                   | —                |

Each domain has its own GA4 property, under the "Zikrasoft" Analytics account;
reusing another's is not allowed. Yandex Metrika was removed from all three —
see [ADR-0033](../adr/0033-google-analytics-instead-of-yandex-metrica.md) for
why, superseding [ADR-0012](../adr/0012-yandex-metrica-only-starting-before-consent.md).

All three behave the same way: `gtag('config', …)` is queued on the first page
load, and `gtag/js` itself is fetched after `load`, while the browser is idle —
it is off the critical path, but not one pageview is lost because of it. On
carlab.rs, the same already-installed gtag.js (loaded for the `AW-18508613563`
Google Ads tag) also carries the GA4 config — no second script. An explicit
refusal in the banner takes effect from the next load — there is no way to
unload a tag that has already started. **GA4 has no equivalent to Metrika's
`webvisor` session recording** — that capability was dropped, not replaced; see
the open issue tracking a Microsoft Clarity add-on.

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

| Secret                           | For what                                       | Where to get it                                                |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `OPENAI_API_KEY`                 | the `translate` job (content auto-translation) | OpenAI. **GitHub only, not needed on Vercel**                  |
| `VERCEL_TOKEN`                   | every deploy job                               | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID`                  | every deploy job                               | `.vercel/project.json` → `orgId` after `vercel link`           |
| `VERCEL_PROJECT_ID`              | the approved.rs deploy                         | Project Settings → General of that project                     |
| `VERCEL_PROJECT_ID_AUTO_SERVICE` | the carlab.rs deploy                           | the same, on the carlab.rs project                             |
| `VERCEL_PROJECT_ID_DETAILING`    | the details.rs deploy                          | the same, on the details.rs project                            |
| `CARLAB_SHOP_VPS_HOST`           | the shop deploy (the server's IPv4)            | Hetzner Console                                                |
| `CARLAB_SHOP_VPS_USER`           | the shop deploy                                | `deploy` (created by `bootstrap-host.sh`)                      |
| `CARLAB_SHOP_VPS_SSH_KEY`        | the shop deploy (CI's private key)             | `ssh-keygen -t ed25519`; the public half gets `restrict`       |
| `CARLAB_SHOP_VPS_KNOWN_HOSTS`    | the shop deploy (the host key)                 | `ssh-keyscan -t ed25519 <IPv4>`, fingerprint verified apart    |

`CARLAB_SHOP_VPS_*` are **repository** secrets, not `production` environment
secrets: `shop-image` has no environment, and with environment secrets it would not
push the image while `deploy-shop` would try to pull a tag that does not exist.
Until all four are set, `shop-image` does not push and `deploy-shop`'s `guard` step
prints "`CARLAB_SHOP_VPS_* secrets are not set, skipping the shop deploy.`", and the
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

| Job                 | `permissions`                       | Why exactly that much                                                                    |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `check`             | `contents: read`                    | checkout only                                                                            |
| `translate`         | `contents: write`                   | commits and pushes translations into the same branch                                     |
| `verify`            | `contents: read`                    | a checkout with `fetch-depth: 0` — the `deployed/*` tags arrive with the history         |
| `shop-image`        | `contents: read`, `packages: write` | pushes `ghcr.io/zikrasoft/podbor-carlab-shop:<sha>` to GHCR                              |
| `deploy-shop`       | `contents: read`, `packages: read`  | hands the server a one-shot token for `docker pull`; that token cannot write to the repo |
| `record-shop`       | `contents: write`                   | moves `deployed/carlab-shop` after a successful `deploy-shop`, a separate job for that   |
| `deploy`            | `contents: write`                   | moves `refs/tags/deployed/approved-rs` after a successful deploy                         |
| `deploy-brand-site` | `contents: write`                   | the same for `deployed/detailing` and `deployed/auto-service`                            |

Write access for `translate` and write access for the deploy jobs are different
things: the first changes a branch's contents, the second touches only housekeeping
tags. Moving `deployed/carlab-shop` is its own `record-shop` job on purpose:
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

`apps/carlab-shop` is not on Vercel. It is docker compose on a single Hetzner Cloud
server (CX23: 2 vCPU x86, 4 GB; the fallback is CPX22), all described in
`infra/carlab-shop/`:

| File                                     | What it is                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile` + `Dockerfile.dockerignore` | the production image: `pnpm --filter @podbor/carlab-shop build`, `pnpm deploy --legacy`; runtime from `.medusa/server` as `node` |
| `docker-compose.yml`                     | postgres 16.15, typesense 30.2, medusa (the GHCR image by sha), caddy 2.11.4                                                     |
| `caddy/Caddyfile`                        | `api.carlab.rs` → `medusa:9000`, TLS, security headers, request body up to 25 MB; `/static/*` straight from the uploads volume   |
| `production.env.example`                 | the template for `/srv/carlab/.env`                                                                                              |
| `deploy.sh`, `backup.sh`, `restore.sh`   | shipping, the nightly backup, restore                                                                                            |
| `bootstrap-host.sh`, `harden-ssh.sh`     | first-time server setup (once, by hand)                                                                                          |
| `test/*.test.sh`                         | the compose shape and the scripts' behaviour against a stubbed `docker`, run in `check`                                          |

There is no Redis: one Medusa process runs the in-memory event bus, cache and
workflow engine. A second Medusa instance would need Redis first.

### The server

- `/srv/carlab/`: CI places `docker-compose.yml`, `caddy/Caddyfile` and the scripts
  there on every deploy; `.env` (mode 600) is written by hand once;
  `.previous-tag` holds the previously shipped sha, for rollback. After a successful
  ship, `deploy.sh` deletes shop images other than the current one and
  `.previous-tag` (a failed deletion does not fail the deploy), otherwise every ship
  leaves a few hundred MB on the disk.
- `/var/backups/carlab/`: backups, kept for 7 days; the cron
  `/etc/cron.d/carlab-backup` at 03:30 UTC, logging to `/var/log/carlab-backup.log`.
  Each night holds a `pg_dump` of the catalogue and an archive of Medusa's uploaded
  files. If a deploy or a backup is killed mid-run (a reboot, a `kill -9`),
  `.deploy.lock` is left behind and blocks both: once you have confirmed that
  neither `deploy.sh` nor `backup.sh` is running (`pgrep -f "deploy.sh|backup.sh"`),
  remove it with `rmdir /srv/carlab/.deploy.lock`. This is a copy on the same disk;
  the off-server copy is Hetzner's automatic backups, switched on when the server is
  created.
- **Typesense is not backed up.** Its index is derived from Postgres and rebuilt by
  the reindex at every Publish (ADR-0041), so after a restore search stays empty
  until the next Publish.
- Only Caddy is published outward: 80, 443, 443/udp. Medusa, Postgres and Typesense
  have no host ports; Postgres and Typesense sit on an internal network with no
  route to the internet, and the storefront reaches search only through Medusa's
  store routes. Checked by `infra/carlab-shop/test/compose.test.sh`.
- IPv6 reaches Caddy directly: the `edge` network is dual-stack (`enable_ipv6`, ULA
  `fd00:ca7:1ab::/64`) and `userland-proxy` is disabled in `daemon.json`. Never turn
  the userland proxy back on, or every IPv6 client becomes the docker gateway's
  address.
- Memory limits for 4 GB: medusa 1536m (a 1024 MB Node heap), typesense 768m,
  postgres 512m, caddy 128m, under 3.2 GB together (checked by the compose test).
  Typesense holds its whole index in memory; measure it with
  `docker stats --no-stream` once the catalogue is at scale, and raise the limit
  before the index outgrows it.

### Uploaded images

Brand-number and Category photos go through Medusa's File module with the local
provider. The admin posts the original (JPEG, PNG or WebP, up to 10 MB, checked by
decoding it, not by its name); the backend writes 160, 480 and 960 px WebP copies
into `/server/static`, the `static` volume, and stores their URLs on the PartIdentifier or
Category. Caddy mounts the same volume read-only at `/srv/static` and answers
`/static/*` itself with a year-long immutable cache, since every file name carries
an upload timestamp; Medusa never sees those requests. The nightly backup already
archives the volume. Moving to S3 later is a provider swap in `medusa-config.ts`
plus a copy of the volume; the stored URLs would need rewriting once.

### `.env`

The template is `infra/carlab-shop/production.env.example`, and `src/lib/env.ts`
validates everything at startup. The non-obvious parts:

- do not touch `MEDUSA_TAG` by hand: `deploy.sh` rewrites it.
- `POSTGRES_PASSWORD`, `TYPESENSE_API_KEY`, `JWT_SECRET`, `COOKIE_SECRET`:
  `openssl rand -hex 32`. Hex specifically: compose substitutes `$…` inside `.env`.
- `DATABASE_URL` and the `TYPESENSE_HOST`/`PORT`/`PROTOCOL` are not written into
  `.env`: compose assembles them from the service names, `POSTGRES_PASSWORD` and
  `TYPESENSE_API_KEY`, and hands the same key to Typesense itself.
- `OPENAI_API_KEY` and `PUBLISH_DISPATCH_TOKEN` feed the admin's Publish chain:
  the first translates catalogue text, the second is a fine-grained GitHub token
  with `actions: write` on this repository that dispatches `publish.yml`. Either
  may stay empty; the chain then stops at that step and the admin shows why.
  `publish.yml` rebuilds carlab.rs from the `deployed/auto-service` tag, so it
  ships fresh catalogue data and never code that is not live yet. The chain runs
  only from the admin's Publish button, in the top bar of every admin page.
  There is no nightly run: cart and checkout quote price and stock live, and a
  build bakes the prices current at that moment into the pages' structured data.
- `LEAD_ROUTE_URL` is where a placed order goes: the `order.placed` subscriber
  posts it to carlab.rs's own `/api/leads` as a `parts-order` Lead, which
  reaches Telegram like every other Lead. Empty, orders are placed but reach
  nobody, and the log says so.
- `VIN_DECODERS` is the VIN decoder chain, comma-separated, in the order they
  are tried. An unknown name stops the server at startup.
- `TYPESENSE_API_KEY` has a local default only outside production; with
  `NODE_ENV=production` an empty one stops the server at startup.
- `FILE_URL` is the public address of uploaded files, stored into every image
  URL at upload time. Compose sets it to `https://$API_HOST/static`, so it is not
  written into `.env`; without it production stops at startup.
- Never print the file. Read a single value with `sed -n 's/^NAME=//p'` into a
  variable, or list names only: `cut -d= -f1 /srv/carlab/.env`.

### How it ships

1. `shop-image` builds the image from the SHA after `translate`, migrates an empty
   database on the CI runner (`apps/carlab-shop/docker-compose.test.yml`) with it,
   and boots it to `healthy`. On branches that is all. On `main`, and only if
   `carlab-shop` is in the `scope` list, it pushes
   `ghcr.io/zikrasoft/podbor-carlab-shop:<sha>`, and only when all four
   `CARLAB_SHOP_VPS_*` secrets are set; otherwise the step says so and finishes
   without pushing.
2. `deploy-shop` tars the stack files over ssh into `/srv/carlab`, logs the server
   into GHCR with the job's one-shot token (piped on stdin, never on a command
   line), runs `deploy.sh <sha>` and logs out (including on failure). This job
   **does not move** the `deployed/carlab-shop` tag: the next one, `record-shop`,
   does, with its own `contents: write`; the token `deploy-shop` sends to the
   server cannot write to the repository.
3. `deploy.sh`: refuses without `.env` and for anything that is not a 40-character
   sha; pulls the image; runs migrations in a one-off container
   (`medusa db:migrate --execute-safe-links --all-or-nothing` from `/server`); only
   after a successful migration does `MEDUSA_TAG` in `.env` change, with the old one
   going to `.previous-tag`; `up -d --wait`; `caddy reload`; then checks
   `https://api.carlab.rs/health`. It prints stage names and the tag, never a value
   from `.env` (`infra/carlab-shop/test/scripts.test.sh` plants a canary secret and
   fails if any script prints it).
4. `record-shop` moves `deployed/carlab-shop` only if `deploy-shop` actually shipped
   the image (`outputs.deployed == 'true'`).
5. `deploy-brand-site` waits for `deploy-shop` and is held back only if it failed, so
   carlab.rs never prerenders against a backend that failed to ship. approved.rs
   does not wait: it does not read the shop.

`scope` treats `apps/carlab-shop` like any other app, plus one rule: a change under
`infra/carlab-shop/` redeploys it, because turbo cannot see files outside the
workspace.

CI places the stack files before `deploy.sh` and outside its lock: if a migration
fails, the new `docker-compose.yml` and `Caddyfile` sit next to the old image, and
the next restart or rollback will bring the old image up with them.

Until the shop's first deploy (the `CARLAB_SHOP_VPS_*` secrets) there is no
`deployed/carlab-shop` tag, and every push to `main` builds, migrates and boots the
image while carlab.rs waits for `deploy-shop`. That is expected, not a `scope` bug.

### Rollback

```bash
ssh deploy@<IPv4> '/srv/carlab/deploy.sh "$(cat /srv/carlab/.previous-tag)"'
```

Do not run that command twice: the rollback itself rewrites `.previous-tag` with the
bad sha, and a second run would ship it back. Note the good sha down before rolling
back (`cat /srv/carlab/.previous-tag`).

Only the image rolls back: migrations do not. If the ship changed the schema,
restore from a backup instead: Medusa's migrations are not guaranteed to be
backwards compatible, and an old image against a schema already migrated forward
may fail to boot or corrupt data. After a manual rollback the
`deployed/carlab-shop` tag points at a version that is not in production; delete it
once the fix is in `main`.

### Backup and restore

```bash
ssh deploy@<IPv4> /srv/carlab/backup.sh
ssh deploy@<IPv4> 'ls -la /var/backups/carlab'
ssh deploy@<IPv4> '/srv/carlab/restore.sh /var/backups/carlab/db-<stamp>.dump /var/backups/carlab/static-<stamp>.tar.gz'
```

`restore.sh` refuses to write into a database that already has tables unless
`RESTORE_OVER_EXISTING=yes` is set. On a clean server (DR) the first deploy comes
first (compose will not come up without `MEDUSA_TAG` in `.env`), and only then
`RESTORE_OVER_EXISTING=yes /srv/carlab/restore.sh …` over the empty migrated
database, then a Publish to rebuild search. `backup.sh` takes the same
`.deploy.lock` as `deploy.sh`: if a deploy is running at 03:30, the backup is
skipped with a non-zero exit code and a line in `/var/log/carlab-backup.log`.
Migrations and creating an admin run from the image only
(`docker compose exec -T medusa node_modules/.bin/medusa …`), never from a
repository checkout: the image has no ts-node.

### Checking the stack locally

The same compose comes up on your own machine with no separate override, through
variables in `infra/carlab-shop/.env` (covered by `.gitignore`'s `.env`):
`API_HOST=localhost`, `HTTP_PORT=8080`, `HTTPS_PORT=8443`,
`MEDUSA_IMAGE=podbor-carlab-shop`, `MEDUSA_TAG=local`, plus the secrets. The image
comes from `docker build -f infra/carlab-shop/Dockerfile -t podbor-carlab-shop:local .`.
Check with `curl -k https://localhost:8443/health`.

### Easy to miss

- **The admin opens in Russian.** Medusa keeps the admin language in the
  browser (the `lng` cookie and `localStorage` key), not on the user, and falls
  back to English. `adminLanguage` in `apps/carlab-shop/src/lib/admin-language.ts`,
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
  Never add `ports:` to another service in the compose stack.
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
- **The backup cron runs in the host's timezone**, which on Hetzner images is UTC.
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
> section: every step happens outside the repository (Hetzner Console, DNS at the
> registrar, GitHub Secrets).

1. **Hetzner.** Create the server: CX23 (fallback CPX22), Ubuntu 24.04, IPv4 + IPv6,
   automatic backups on.
   Done: the server is visible in the Console with both addresses and backups on.
2. **Bootstrap.** Log in as root over an ssh key, upload
   `infra/carlab-shop/bootstrap-host.sh` and `infra/carlab-shop/harden-ssh.sh`, and
   run `bootstrap-host.sh`. Open a separate session, `ssh deploy@<IPv4>`, and **keep
   it open** until key-based login has been re-verified after hardening. From it,
   run `harden-ssh.sh` **through `sudo`**.
   Done: `ssh deploy@<IPv4>` lets you in by key; `ssh root@<IPv4>` refuses.
3. **DNS.** A and AAAA records for `api.carlab.rs` at the server's addresses. If
   IPv6 does not work at the host or on the network, remove the AAAA record.
   Done: `dig +short api.carlab.rs` and `dig +short AAAA api.carlab.rs` return them.
4. **`.env` on the server.** Copy `infra/carlab-shop/production.env.example` to
   `/srv/carlab/.env`, fill in every value (secrets with `openssl rand -hex 32`),
   then `chmod 600 /srv/carlab/.env`.
   Done: `ssh deploy@<IPv4> 'stat -c %a /srv/carlab/.env'` prints `600`.
5. **CI secrets.** Generate CI's ssh key (`ssh-keygen -t ed25519`), restrict the
   public half on the server (`restrict` in `authorized_keys`), obtain
   `known_hosts` (`ssh-keyscan -t ed25519 <IPv4>`) and **verify the fingerprint**
   separately. Record `CARLAB_SHOP_VPS_USER`, `CARLAB_SHOP_VPS_SSH_KEY` and
   `CARLAB_SHOP_VPS_KNOWN_HOSTS` in the **repository's** secrets, and
   `CARLAB_SHOP_VPS_HOST` **last**: with it in place, the next push to `main`
   deploys.
   Done: all four secrets are visible in Settings → Secrets and variables → Actions.
6. **The first deploy.** A push to `main` or Actions → CI → Run workflow. Check the
   package in GHCR: linked to the repository, Actions read access configured.
   Done: `deploy-shop` is green, `record-shop` moved `deployed/carlab-shop`, and
   `https://api.carlab.rs/health` answers 200.
7. **Admin.** Create an admin
   (`docker compose exec -T medusa node_modules/.bin/medusa user --invite`), sign in
   at `https://api.carlab.rs/app`, and issue the publishable key carlab.rs uses.
   Done: signing in works and the key is in the carlab.rs Vercel project.
8. **Acceptance.** `docker stats --no-stream` under light load stays within the
   memory limits; a manual `ssh deploy@<IPv4> /srv/carlab/backup.sh` works; the next
   morning `/var/log/carlab-backup.log` shows the cron ran.

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

In the group the bot needs **admin rights to pin messages**: every new card is
pinned and a closed one is unpinned; without the right both calls fail and are
only logged.

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
