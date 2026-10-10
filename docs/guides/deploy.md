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
| `apps/auto-service` | `carlab.rs`   | CarLab — auto service          | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`, `/api/shop-order` (the shop's order hook)        |
| `apps/detailing`    | `details.rs`  | Details — detailing            | the site plus `/api/leads`, `/api/contact-click`, `/api/telegram-capture`                                                   |

Each app owns its own `astro.config.mjs`, `vercel.json`, `keystatic.config.ts` and
`.env*`. The Vercel CLI identifies the project from the working directory, so every
deploy job runs entirely from its own `apps/<app>`.

**Four bots, one chat, one lead store, three brands.** `@SerbCRMBot` is the CRM
bot — cards, statuses, money, postpone, reminders and shop-order notifications —
and it is the same bot in all three projects; Telegram allows exactly one webhook
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
shellcheck, actionlint) → `translate` → `verify`; in parallel with them
`medusa-integration` (Medusa's HTTP tests against postgres and redis from
`services:`), which only `medusa-image` waits for. Then `medusa-image` →
`deploy-medusa` → `record-medusa` (which moves the tag), `deploy` (approved.rs) and
`deploy-brand-site`: both site deploys wait for `deploy-medusa` and are held back
only if it _failed_ (a skipped `deploy-medusa` does not hold them) — otherwise a
broken VPS would ship approved.rs without the other two sites and split the lead
schema in `data/leads.json`. The `deploy*` jobs only run on `main`, each only if
the previous one passed. The workflow fires on a push to any **branch** and never
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

| What `scope` sees                                                                                | Decision                   |
| ------------------------------------------------------------------------------------------------ | -------------------------- |
| the `deployed/<app>` tag does not exist yet                                                      | deploy                     |
| the tag is not an ancestor of `HEAD` (force-push, branch rollback)                               | deploy                     |
| a root build file changed (list below)                                                           | deploy                     |
| `turbo --filter="...[<tag>]"` names the package as changed                                       | deploy                     |
| turbo failed, or its output could not be parsed                                                  | deploy                     |
| `apps/medusa`: something under `infra/medusa/` changed                                           | deploy                     |
| `auto-service`: the site's `catalog-version.txt` ≠ Medusa's catalog version, or it is unreadable | deploy                     |
| `auto-service`: the site answers 404 on `catalog-version.txt`, or `disabled`                     | this check does not deploy |
| turbo affirmatively said the package is not among the changed ones                               | skip                       |

**`infra/medusa/` is checked separately**, like the root files: turbo only knows
about workspace packages and attributes everything else to `//`, so without that
line an edit to the Dockerfile, the compose file, the Caddyfile or the scripts would
never ship the backend.

**The shop catalog is its own reason to ship carlab.rs.** Prices and products are
baked into static output, so a catalog edit in the Medusa admin has to rebuild the
site even when the code did not change. After an edit Medusa triggers
`workflow_dispatch` on `ci.yml` (`GITHUB_DISPATCH_TOKEN`), and the `scope` step
compares `https://carlab.rs/catalog-version.txt` (the version the site was built
with) against `GET $MEDUSA_URL/store/catalog-version` via
`.github/scripts/catalog-stale.sh`. The script answers "don't deploy" in exactly
three cases: the versions are equal; the site answers `disabled` (the shop is off);
the site answers 404 — the file does not exist yet and the shop has not launched
(Plan 4 will create it). Everything else — the network, a 5xx, a missing
`MEDUSA_URL`/`MEDUSA_PUBLISHABLE_KEY`, Medusa answering something that is not JSON,
`unstamped` (the catalog was never stamped) — means "deploy": uncertainty, as
everywhere in `scope`, is answered with a surplus deploy rather than a missed one.
Tests for every branch are in `.github/scripts/catalog-stale.test.sh`.

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
otherwise any workflow edit would ship all three sites.

That includes `apps/medusa`: an Astro bump rebuilds and migrates the backend, and a
Medusa bump redeploys the three sites. That was decided deliberately (Plan 3): there
is one lockfile, `scope` cannot attribute a change to one app, and a surplus deploy
is the cheaper mistake in that direction. By the same logic `setup-pnpm` installs
the whole workspace (Medusa's ~680 MB included) in every job — until that measurably
hurts, we don't introduce `pnpm install --filter`.

### The `deployed/*` tags

`refs/tags/deployed/approved-rs`, `deployed/detailing`, `deployed/auto-service` and
`deployed/medusa` appear and move on their own: the last step of each deploy job
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
  holds the token/IDs for reaching Vercel plus `OPENAI_API_KEY` (see below),
  which approved.rs also needs in its Vercel project for free-form Payouts;
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
| `PUBLIC_TG_MANAGER`      | ✅          | —           | —           | none                         | `/thanks/` opens the bot     |

### Analytics — no environment variables

The counters are baked into each `src/utils/constants.ts` and are never read from
the environment: they are not secrets, they are publicly visible in any request from
the site, and spreading them across three Vercel dashboards would create a third
place to get them wrong.

| Site        | Yandex Metrika |
| ----------- | -------------- |
| approved.rs | `111800377`    |
| carlab.rs   | `112647692`    |
| details.rs  | `112647721`    |

Each domain has its own counter; reusing another's is not allowed. Google Analytics
was removed from all three — 167 KiB of gtag.js left the bundle entirely.

All three behave the same way: the hit goes into the `ym` queue on the first page
load, and `tag.js` itself is fetched after `load`, while the browser is idle — it is
off the critical path, but not one pageview is lost because of it. An explicit
refusal in the banner takes effect from the next load — there is no way to unload a
Metrika counter that has already started. Metrika is initialised with
`webvisor: true`, meaning it records sessions; the enquiry form is excluded from the
recording by the `ym-hide-content ym-disable-keys` classes on `LeadForm.astro` in
all three apps.

**If you change a counter, or enable analytics somewhere it was absent**, three
things travel with it: the Russian `privacy` section in
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
| `TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB`  | optional    | —         | —          | capture | the reply button is absent on CarLab's cards                                   |
| `TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS` | optional    | —         | —          | capture | the reply button is absent on Details' cards                                   |

> **The main trap when setting up new projects.** All three `src/lib/crmBot.ts`
> call `requireEnv('TELEGRAM_BOT_TOKEN')`, `requireEnv('TELEGRAM_BOT_USERNAME')` and
> `requireEnv('TELEGRAM_GROUP_ID')` at module top level. The `/api/leads` and
> `/api/contact-click` routes are `prerender = false`, so **the build succeeds** and
> the first real request in production is what fails. It is easy to ship a "green"
> deploy with a dead form.

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
the owner's reply to a handle-less visitor lands on the CRM webhook there, and
only the visitor's own brand's bot can deliver it, so the webhook picks the bot by
the lead's `brand` ([ADR-0030](../adr/0030-a-capture-bot-per-brand-takes-the-telegram-contact.md)).
Without a sibling token the reply button is simply absent on that brand's cards.

### OpenAI (approved.rs only)

| Variable         | approved.rs | carlab.rs | details.rs | Without it                                                                                                                                               |
| ---------------- | ----------- | --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | ✅          | —         | —          | an owner message with an amount in the group gets "could not read the amount" and no draft; a voice message gets "could not recognise the voice message" |

The CRM webhook reads the owner's free-form group messages (`Иван, сервис
повторно, 30`) through an OpenAI model into a draft Payout. It is the same key
as the GitHub secret below; the webhook still answers buttons and card replies
without it, and only the free-form path fails. An owner voice message, in the
group or as a reply to a card, is transcribed first (`gpt-4o-mini-transcribe`,
Telegram's OGG/Opus uploaded as-is) and then takes the same path; a voice reply
to a card drafts the Payout on that card's Lead.

### Storage and cron

| Variable                | approved.rs | carlab.rs | details.rs | Without it                                            |
| ----------------------- | ----------- | --------- | ---------- | ----------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` | ✅ auto     | ✅ auto   | ✅ auto    | leads are not stored and the routes fail              |
| `CRON_SECRET`           | ✅          | —         | —          | `/api/reminders` answers 401 — reminders never go out |

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

| Secret                           | For what                                       | Where to get it                                                            |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                 | the `translate` job (content auto-translation) | OpenAI. Also set on approved.rs in Vercel, for free-form and voice Payouts |
| `VERCEL_TOKEN`                   | every deploy job                               | [vercel.com/account/tokens](https://vercel.com/account/tokens)             |
| `VERCEL_ORG_ID`                  | every deploy job                               | `.vercel/project.json` → `orgId` after `vercel link`                       |
| `VERCEL_PROJECT_ID`              | the approved.rs deploy                         | Project Settings → General of that project                                 |
| `VERCEL_PROJECT_ID_AUTO_SERVICE` | the carlab.rs deploy                           | the same, on the carlab.rs project                                         |
| `VERCEL_PROJECT_ID_DETAILING`    | the details.rs deploy                          | the same, on the details.rs project                                        |
| `MEDUSA_VPS_HOST`                | the Medusa deploy (the server's IPv4)          | Hetzner Console                                                            |
| `MEDUSA_VPS_USER`                | the Medusa deploy                              | `deploy` (created by `bootstrap-host.sh`)                                  |
| `MEDUSA_VPS_SSH_KEY`             | the Medusa deploy (CI's private key)           | `ssh-keygen -t ed25519`; the public half gets `restrict` on the server     |
| `MEDUSA_VPS_KNOWN_HOSTS`         | the Medusa deploy (the host key)               | `ssh-keyscan -t ed25519 <IPv4>`, fingerprint verified separately           |
| `MEDUSA_PUBLISHABLE_KEY`         | the `scope` step (the catalog version)         | Medusa admin → Settings → Publishable API Keys                             |

`MEDUSA_VPS_*` are **repository** secrets, not `production` environment secrets:
`medusa-image` has no environment, and with environment secrets it would not push
the image, while `deploy-medusa` would try to pull a tag that does not exist.

Plus a **variable** (Variables, not Secrets), `MEDUSA_URL` = `https://api.carlab.rs`.
Until `MEDUSA_VPS_*` are set, the `guard` step in `deploy-medusa` prints
"`MEDUSA_VPS_* secrets are not set — skipping the medusa deploy.`", and
`medusa-image` does not push the image ("`MEDUSA_VPS_* secrets are not set — nothing
will deploy the image, so it is not pushed.`"; it pushes only when all four are
set) — and the workflow is green.

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

| Job                  | `permissions`                       | Why exactly that much                                                                      |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `check`              | `contents: read`                    | checkout only                                                                              |
| `translate`          | `contents: write`                   | commits and pushes translations into the same branch                                       |
| `verify`             | `contents: read`                    | a checkout with `fetch-depth: 0` — the `deployed/*` tags arrive with the history           |
| `medusa-integration` | `contents: read`                    | checkout only                                                                              |
| `medusa-image`       | `contents: read`, `packages: write` | pushes `ghcr.io/zikrasoft/podbor-medusa:<sha>` to GHCR                                     |
| `deploy-medusa`      | `contents: read`, `packages: read`  | hands the server a one-shot token for `docker pull`; that token cannot write to the repo   |
| `record-medusa`      | `contents: write`                   | moves `deployed/medusa` after a successful `deploy-medusa` — a separate job, only for that |
| `deploy`             | `contents: write`                   | moves `refs/tags/deployed/approved-rs` after a successful deploy                           |
| `deploy-brand-site`  | `contents: write`                   | the same for `deployed/detailing` and `deployed/auto-service`                              |

Write access for `translate` and write access for the deploy jobs are different
things: the first changes a branch's contents, the second touches only housekeeping
tags. Moving `deployed/medusa` was split into its own `record-medusa` job on
purpose: `deploy-medusa` sends its `GITHUB_TOKEN` to the server (a one-shot GHCR
login), and a token that can write to the repository has no business being there —
what travels to the VPS is a token that can only read packages. An accepted risk:
that same token also carries `contents: read`, so while the job is alive the private
repository can be read from the server. Beyond `contents`, the workflow asks only
for `packages`, and only in the two Medusa jobs.

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

`apps/medusa` is not on Vercel. It is docker compose on a single Hetzner Cloud
server (CX23: 2 vCPU x86, 4 GB; the fallback is CPX22), all described in
`infra/medusa/`:

| File                                     | What it is                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Dockerfile` + `Dockerfile.dockerignore` | the production image: packages through turbo, `pnpm --filter @podbor/medusa build`, `pnpm deploy --legacy`; runtime from `.medusa/server` under `node` |
| `docker-compose.yml`                     | postgres 16.15, redis 7.4.9, medusa (the GHCR image by sha), caddy 2.11.4                                                                              |
| `caddy/Caddyfile`                        | `api.carlab.rs` → `medusa:9000`, TLS, security headers, request body up to 25 MB                                                                       |
| `production.env.example`                 | the template for `/srv/carlab/.env`                                                                                                                    |
| `deploy.sh`, `backup.sh`, `restore.sh`   | shipping, the nightly backup, restore                                                                                                                  |
| `bootstrap-host.sh`, `harden-ssh.sh`     | first-time server setup (once, by hand)                                                                                                                |

### The server

- `/srv/carlab/` — CI places `docker-compose.yml`, `caddy/Caddyfile` and the scripts
  there on every deploy; `.env` (mode 600) is written by hand once;
  `.previous-tag` holds the previously shipped sha, for rollback. After a successful
  ship, `deploy.sh` deletes Medusa images other than the current one and
  `.previous-tag` (a failed deletion does not fail the deploy) — otherwise ~650 MB
  per ship fills the disk.
- `/var/backups/carlab/` — backups, kept for 7 days; the cron
  `/etc/cron.d/carlab-backup` at 03:30 UTC, logging to `/var/log/carlab-backup.log`.
  If a deploy or a backup is killed mid-run (a reboot, a `kill -9`),
  `.deploy.lock` is left behind and blocks both — once you have confirmed that
  neither `deploy.sh` nor `backup.sh` is running (`pgrep -f "deploy.sh|backup.sh"`),
  remove it: `rmdir /srv/carlab/.deploy.lock`. This is a copy on the same disk;
  the off-server copy in phase 1 is Hetzner's automatic backups.
- Only Caddy is published outward: 80, 443, 443/udp. Medusa, Postgres and Redis have
  no host ports; Postgres and Redis sit on an internal network with no route to the
  internet. This is not cosmetic: Medusa's rate limits key on `req.ip` (IPv6 by its
  /64) with `trust proxy 1`, and Caddy overwrites `X-Forwarded-For` with the client's
  address. Any second proxy or CDN in front of Caddy would make every client one
  address. Checked by `infra/medusa/test/compose.test.sh`.
- IPv6 reaches Caddy directly: the `edge` network is dual-stack (`enable_ipv6`, ULA
  `fd00:ca7:1ab::/64`) and `userland-proxy` is disabled in `daemon.json`. Never turn
  the userland proxy back on — every IPv6 client would become the docker gateway's
  address and land in one rate-limit bucket.
- Memory limits for 4 GB: medusa 1536m (a 1024 MB Node heap), postgres 512m, redis
  256m, caddy 128m. At idle during the plan's verification: medusa ~310–410 MiB,
  postgres ~40 MiB, redis ~6 MiB, caddy ~60 MiB. Real figures under load come after
  the first deploy (`docker stats --no-stream`).

### `.env`

The template is `infra/medusa/production.env.example`, and `env.ts` validates
everything at startup. The non-obvious parts:

- do not touch `MEDUSA_TAG` by hand — `deploy.sh` rewrites it.
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` — `openssl rand -hex 32`. Hex
  specifically: compose substitutes `$…` inside `.env`.
- `DATABASE_URL` and `REDIS_URL` are not written into `.env`: compose assembles them
  from the service names and `POSTGRES_PASSWORD`.
- `REBUILD_ON_CATALOG_EVENTS=true` — it defaults to `false`, and then a catalog edit
  will never rebuild the site.
- `SHOP_ORDER_HOOK_URL` and `SHOP_ORDER_HOOK_SECRET` — as a pair only; empty until
  carlab.rs has a receiver (Plan 4).
- `GITHUB_DISPATCH_TOKEN` — a fine-grained PAT scoped to this repository only,
  Actions: Read and write.

### How it ships

1. `medusa-image` builds the image from the SHA after `translate` (so the translated
   `emails.yaml` goes into the image), migrates an empty database from `services:`
   with it, and boots it to `healthy`. On branches that is all. On `main` — and only
   if `medusa` is in the `scope` list — it pushes
   `ghcr.io/zikrasoft/podbor-medusa:<sha>`, and only when all four `MEDUSA_VPS_*`
   secrets are set; otherwise the step prints a warning and finishes quietly without
   pushing.
2. `deploy-medusa` tars the stack files over ssh into `/srv/carlab`, logs the server
   into GHCR with the job's one-shot token, runs `deploy.sh <sha>` and logs out
   (including on failure). This job **does not move** the `deployed/medusa` tag —
   the next one, `record-medusa`, does, with its own `contents: write`; the token
   `deploy-medusa` sends to the server cannot write to the repository.
3. `deploy.sh`: refuses without `.env` and for anything that is not a 40-character
   sha; pulls the image; runs migrations in a one-off container
   (`medusa db:migrate --execute-safe-links --all-or-nothing` from `/server`); only
   after a successful migration does `MEDUSA_TAG` in `.env` change, with the old one
   going to `.previous-tag`; `up -d --wait`; `caddy reload`; then checks
   `https://api.carlab.rs/health/ready`.
4. `record-medusa` moves `deployed/medusa` only if `deploy-medusa` actually shipped
   the image (`outputs.deployed == 'true'`).
5. `deploy` and `deploy-brand-site` wait for `deploy-medusa` and are held back only
   if it failed.

CI places the stack files before `deploy.sh` and outside its lock: if a migration
fails, the new `docker-compose.yml` and `Caddyfile` sit next to the old image, and
the next restart or rollback will bring the old image up with them.

Until Medusa's first deploy has happened (the `MEDUSA_VPS_*` secrets appear in
Part 3B) there is no `deployed/medusa` tag, and every push to `main` builds,
migrates and boots the image (while the sites wait for `deploy-medusa`). That is
expected, not a `scope` bug.

### Rollback

```bash
ssh deploy@<IPv4> '/srv/carlab/deploy.sh "$(cat /srv/carlab/.previous-tag)"'
```

Do not run that command twice: the rollback itself rewrites `.previous-tag` with the
bad sha, and a second run would ship it back. Note the good sha down before rolling
back (`cat /srv/carlab/.previous-tag`).

Only the image rolls back: migrations do not. If the ship changed the schema,
restore from a backup instead (Medusa's migrations are not guaranteed to be
backwards compatible — an old image against a schema already migrated forward may
fail to boot or corrupt data; see "Easy to miss" below). After a manual rollback the
`deployed/medusa` tag points at a version that is not in production; delete it once
the fix is in `main`.

### Backup and restore

```bash
ssh deploy@<IPv4> /srv/carlab/backup.sh
ssh deploy@<IPv4> 'ls -la /var/backups/carlab'
ssh deploy@<IPv4> '/srv/carlab/restore.sh /var/backups/carlab/db-<stamp>.dump /var/backups/carlab/static-<stamp>.tar.gz'
```

`restore.sh` refuses to write into a database that already has tables unless
`RESTORE_OVER_EXISTING=yes` is set. On a clean server (DR) the first deploy comes
first — compose will not come up without `MEDUSA_TAG` in `.env` — and only then
`RESTORE_OVER_EXISTING=yes /srv/carlab/restore.sh …` over the empty migrated
database. `backup.sh` takes the same `.deploy.lock` as `deploy.sh`: if a deploy is
running at 03:30, the backup is skipped with a non-zero exit code and a line in
`/var/log/carlab-backup.log`. Seeds, migrations and creating an admin run from the
image only (`docker compose exec -T medusa node_modules/.bin/medusa …`, with scripts
as `./src/scripts/<name>.js`), never from a repository checkout: the image has no
ts-node.

### Checking the stack locally

The same compose comes up on your own machine with no separate override — through
variables in `infra/medusa/.env` (which is in `.gitignore`): `API_HOST=localhost`,
`HTTP_PORT=8080`, `HTTPS_PORT=8443`, `MEDUSA_IMAGE=podbor-medusa`,
`MEDUSA_TAG=local`, plus the secrets. The image comes from
`docker build -f infra/medusa/Dockerfile -t podbor-medusa:local .`. Check with
`curl -k https://localhost:8443/health/ready`.

### Easy to miss

- **`.env` is read literally.** `deploy.sh` pulls values out of `.env` with `sed`
  and does not strip quotes — do not wrap values in `"…"`, or the quotes end up in
  the value.
- **`umask 077` on the server.** `deploy.sh` and `backup.sh` set it themselves:
  `.env` and the backup files in `/var/backups/carlab` land with mode 600/700 owned
  by `deploy`.
- **A rollback is only the image.** `deploy.sh <previous_sha>` brings up old code
  against a schema the new image may already have migrated forward; Medusa's
  migrations are not guaranteed to be backwards compatible. If the deploy being
  rolled back changed the schema, the old image may fail to start or corrupt data;
  in that case the rollback is restoring the backup taken before the deploy, not
  `deploy.sh` with the old tag.
- **Only Caddy exposes a port.** `ports:` in docker compose bypasses ufw — the rule
  filters traffic on the host, not what Docker forwards itself through iptables.
  Never add `ports:` to another service in the compose stack.
- **Docker's apt key is not verified by fingerprint.** `bootstrap-host.sh` does not
  pin the fingerprint of Docker's GPG key — it is not on Docker's Ubuntu install
  page. After bootstrapping, check it by hand:
  `gpg --show-keys /etc/apt/keyrings/docker.asc` — and compare it with the
  fingerprint Docker's own documentation publishes (do not copy it in here).
- **CI's key is effectively root.** `deploy` is in the `docker` group (and has
  `NOPASSWD` sudo); the `docker` group is equivalent to root by itself, so
  `restrict` in `authorized_keys` only limits forwarding and pty. An accepted risk.
- **`ufw limit 22/tcp`** allows no more than 6 new connections per 30 seconds from
  one address. `deploy-medusa` opens 4 ssh connections to the server per run
  (uploading the stack files, the GHCR login, running `deploy.sh`, the logout) —
  there is headroom, but do not add ssh calls to that step carelessly.
- **The backup cron runs in the host's timezone**, which on Hetzner images is UTC:
  the `03:30 UTC` above _is_ the server's local time.
  `/var/log/carlab-backup.log` grows without bound — add a logrotate snippet by
  hand (nobody puts one in the repository):
  ```
  /var/log/carlab-backup.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
  }
  ```
- **Ubuntu 24.04 runs ssh through socket activation** — `systemctl reload ssh` after
  `harden-ssh.sh` may not report what you expect. Before closing the first session,
  open a second terminal and confirm that key-based login as `deploy` still works.
- **Caddy has no CSP yet** — `caddy/Caddyfile` sets HSTS,
  `X-Content-Type-Options`, `Referrer-Policy` and `X-Frame-Options` and removes
  `Server`, but Content-Security-Policy is unset. The only limit on uploads into the
  admin is `request_body` `max_size 25MB` in that same Caddyfile.
- **Editing `pnpm-lock.yaml` redeploys Medusa too** — one lockfile for all four
  apps, and `scope` cannot attribute an edit to one of them (see "Root files are
  checked with a separate `git diff`" above). A deliberate decision: a surplus
  deploy is cheaper than a missed one.

### The first ship — a checklist

> A checklist for the human who owns the infrastructure. Each step is a concrete
> command plus a "done" condition. An agent does not execute this section — it
> describes only the steps that have to be done by hand outside the repository
> (Hetzner Console, DNS at the registrar, Brevo, GitHub Secrets).

1. **Hetzner.** In the Console, check CX23 availability (the fallback is CPX22) and
   the price of automatic backups in the region you want. Create the server:
   Ubuntu 24.04, IPv4 + IPv6, automatic backups on.
   Done: the server is visible in the Console and has both addresses.
2. **Bootstrap.** Log in as root over ssh key, upload
   `infra/medusa/bootstrap-host.sh` and `infra/medusa/harden-ssh.sh` to the server,
   and run `bootstrap-host.sh`. Open a separate interactive session,
   `ssh deploy@<IPv4>`, and **keep it open** until key-based login has been
   re-verified after hardening. From it, run `harden-ssh.sh` **through `sudo`**.
   Done: `ssh deploy@<IPv4>` lets you in by key with no password; `ssh root@<IPv4>`
   refuses.
3. **DNS.** Point A and AAAA records for `api.carlab.rs` at the server's IPv4 and
   IPv6. Check IPv6 separately: `curl -6 https://api.carlab.rs/health/ready`
   (nothing is deployed yet — at this step it just has to resolve). If IPv6 is
   unavailable at the host or on the network, remove the AAAA record. After the
   first deploy (step 8), from a machine with IPv6, open a connection and hold it:
   `openssl s_client -6 -connect api.carlab.rs:443 -servername api.carlab.rs`.
   While it is open, on the server in `/srv/carlab`:
   `sudo nsenter -n -t "$(docker inspect -f '{{.State.Pid}}' "$(docker compose ps -q caddy)")" ss -tn '( sport = :443 )'`
   — the Peer column must show the client's global IPv6 address, not
   `fd00:ca7:1ab::1` and not the docker gateway's IPv4. Caddy has no access log, so
   the check goes through the socket.
   Done: `dig +short api.carlab.rs` and `dig +short AAAA api.carlab.rs` return the
   server's addresses.
4. **Brevo.** Verify the `carlab.rs` domain (DKIM + DMARC), issue an API key, and
   create a sender on that domain.
   Done: the domain is marked verified in Brevo, and you have an API key and a
   sender address.
5. **Tokens.** Create a fine-grained PAT for `GITHUB_DISPATCH_TOKEN` (this
   repository only, Actions: Read and write) and an OpenAI key.
   Done: both values are saved in a password manager (not in GitHub yet — that is
   step 7).
6. **`.env` on the server.** Copy `infra/medusa/production.env.example` to
   `/srv/carlab/.env`, fill in every value (passwords with
   `openssl rand -hex 32`), then `chmod 600 /srv/carlab/.env`.
   Done: `ssh deploy@<IPv4> 'stat -c %a /srv/carlab/.env'` prints `600`.
7. **CI secrets.** Generate CI's ssh key (`ssh-keygen -t ed25519`), restrict the
   public half on the server (`restrict` in `authorized_keys`), obtain `known_hosts`
   (`ssh-keyscan -t ed25519 <IPv4>`) and **verify the fingerprint** separately (for
   instance during the first interactive `ssh deploy@<IPv4>`). Record
   `MEDUSA_VPS_USER`, `MEDUSA_VPS_SSH_KEY` and `MEDUSA_VPS_KNOWN_HOSTS` in the
   **repository's** secrets and `MEDUSA_URL` in GitHub Variables; add
   `MEDUSA_VPS_HOST` **last**: with it in place, the next push to `main` deploys.
   Done: all four secrets and the variable are visible in Settings → Secrets and
   variables → Actions.
8. **The first deploy.** Run `ci.yml` (a push to `main` or a `workflow_dispatch`).
   Check the package in GHCR: linked to the repository, with visibility and
   Actions read access configured.
   Done: `deploy-medusa` is green, the `record-medusa` job moved the
   `deployed/medusa` tag, and `https://api.carlab.rs/health/ready` answers 200.
9. **Data.** Run the seeds `seed-base.js` and `seed-batteries.js`
   (`docker compose exec -T medusa node_modules/.bin/medusa exec ./src/scripts/seed-base.js`,
   and the same for the second). Create an admin (`medusa user --invite`). In the
   admin, copy the publishable key that `seed-base.js` created (do not issue a new
   one) into the `MEDUSA_PUBLISHABLE_KEY` secret.
   Done: signing in to `/app` as the new admin works, and
   `MEDUSA_PUBLISHABLE_KEY` is in the secrets.
10. **Acceptance.** `/health/ready` answers 200; a test order through the Store API
    (the order webhook is off — Plan 4); the customer's email arrived;
    `docker stats --no-stream` under light load stays within the memory limits; a
    manual `ssh deploy@<IPv4> /srv/carlab/backup.sh` works; and the next morning,
    check `/var/log/carlab-backup.log` on the server to confirm the cron ran.
    Done: every item passed, with the date and the result recorded next to this
    checklist (outside the repository).

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
sourcing · status") with the outcome buttons (✅ deal / ❌ lost / ⏳ in work) and
an "Open in the bot" link button; postponing, replying to the visitor and
deleting happen in a DM with the bot. Statuses are open / won / lost /
postponed, and lost is the archive. Leads are stored
in Vercel Blob (`data/leads.json`, private access), with no external database.

The owner and the admin each have to message the bot `/start` once before it can
send them direct messages (including the cron's reminders) — Telegram forbids a bot
from starting a conversation.

In the group the bot needs two things a default bot does not have:

- **Privacy mode off.** The owner records a Payout by writing a plain message with
  an amount in the group, not only by replying to a card, and a bot in privacy
  mode never receives such messages. In @BotFather: `/setprivacy` → `@SerbCRMBot`
  → `Disable`. Telegram applies the change only to groups the bot joins
  afterwards, so remove the bot from the group and add it back (an admin bot
  receives every message regardless, which also works). Replies to the bot's own
  cards arrive either way.
- **Admin rights to pin messages.** Every new card is pinned and a closed one is
  unpinned; without the right both calls fail and are only logged.

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
then a locale without a translation gets the Russian text. It is not a CI step,
and a missing `TELEGRAM_CAPTURE_BOT_TOKEN` exits non-zero without calling
Telegram:

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
then posts one digest to the group: postponed leads whose day has come (reopened
once listed), won leads with no Payout, and open leads with no action for 7 days,
each with ✅ ❌ ⏳ — once per day, however often the cron runs. Nothing is
posted when the list is empty. On the 1st (Belgrade
calendar) it then posts the monthly summary — balance, Payouts since the last
one, open leads — once per month. Without
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
