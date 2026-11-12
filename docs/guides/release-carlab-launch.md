# Release runbook: the carlab.rs parts catalogue launch

One pass, top to bottom. Every step names its source as `file § heading`; a
step marked **not documented; ask** has no source in the repository. Never
print a secret: list `.env` names with `cut -d= -f1`, read one value with
`sed -n 's/^NAME=//p'` into a variable (deploy.md § `.env`).

## 0. What ships

The `carlab-shop` branch: the shop backend (`apps/auto-service-shop`, Medusa on
a VPS at `api.carlab.rs`, first production deploy) and the rebuilt carlab.rs
storefront, launched **closed**: `SHOP_OPEN` is not `true` on either side, so
no page carries a price, stock, an Offer or a cart link, and every parts path
ends in «Узнать цену» / an inquiry (deploy.md § Closed beta: the preview flag).
The branch also changes `packages/lead-crm`, `packages/site-kit`,
`packages/catalog-contract`, `packages/lead-capture`, `packages/i18n` and
`packages/brands`, so approved.rs and details.rs deploy in the same run
(AGENTS.md § Monorepo layout, "A `packages/*` change deploys all three sites").

User-visible changes (commit subjects on `carlab-shop`):

- carlab.rs home, header, footer, sticky bar, service, works, contacts, about,
  thanks and 404 pages rebuilt; the hero leads with a call on touch and a
  callback on a mouse; the Google rating shows on the hero, visit block,
  footer and in `llms.txt`.
- The parts catalogue from the shop: parts hub, category pages with filters
  and a make/model picker («Для моего авто»), make and model pages, part pages
  with an order panel, VIN and part-number search with autocomplete.
- Lead forms on all three sites ask one contact question with a passive
  privacy line; the preferred channel comes first; CarLab offers a call first.
- `search` and `search_suggestion_pick` goals on carlab.rs, `lead_modal_open`
  on all three sites, a `visit` contact placement (`packages/site-kit/src/goals.ts`).
- CSP report-only collection on every site (deploy.md § Vercel builds nothing).
- carlab.rs server-side Events go to the shop's log, readable in Grafana
  (ADR-0057).

## 1. Before you start

- [ ] GitHub admin on `Zikrasoft/approved_rs` (secrets, Actions, tags).
- [ ] Vercel access to the three projects (approved.rs, carlab.rs, details.rs).
- [ ] AWS: S3/IAM administrator; DigitalOcean: an API token with write scope (deploy.md § The first ship: a checklist).
- [ ] DNS at the `carlab.rs` registrar (same, step 3).
- [ ] An OpenAI key for the shop, a fine-grained GitHub token for
      `PUBLISH_DISPATCH_TOKEN` (deploy.md § `.env`).
- [ ] The BotFather tokens and `.env.local` of each app for the Telegram
      scripts (deploy.md § The Telegram webhooks).
- [ ] Editor access to the three GA4 properties and the Metrika counters
      (deploy.md § Analytics: no environment variables).
- [ ] Optional: an uptime monitor and a Sentry project (deploy.md § Monitoring).

State found while writing this (2026-11-02): no `AUTO_SERVICE_SHOP_VPS_*`
repository secret and no `deployed/auto-service-shop` tag exist, so the shop
has never shipped and section 3 is a first ship.

State on 2026-11-09: PR #444 merged `carlab-shop` into `main`. `gh secret list`
shows `AUTO_SERVICE_SHOP_VPS_SSH_KEY` and `AUTO_SERVICE_SHOP_VPS_USER` but not
`AUTO_SERVICE_SHOP_VPS_KNOWN_HOSTS` or `AUTO_SERVICE_SHOP_VPS_HOST`, and
`git ls-remote` shows no `deployed/auto-service-shop` tag, so the shop has still
never shipped. A local `infra/auto-service-shop/terraform/terraform.tfstate`
exists; whether `terraform apply` created the infrastructure has not been
checked (`terraform state list` prints names only, never the keys in the state).

## 2. Pre-flight on `carlab-shop`

- [ ] CI is green on the branch head. `main` was green on 2026-11-04 (the run for
      `73d1691c`), so the lead-crm timeout of 2026-11-02 is gone. The last red run,
      on `feat/phone-always-visible` (2026-11-08), failed only in `check`, in
      `src/lib/publish/__tests__/large-catalogue.spec.ts` ("Exceeded timeout of
      360000 ms", the shard with the 70 000-row publish test). That spec also runs
      on the push to `main` that ships the shop, so rerun it and find out whether it
      is slow or flaky before the merge. Fix or rerun until `check`, `translate`
      and `verify` pass (deploy.md § Job order).
- [ ] `translate` committed its "Auto-translate content" commit after the last
      Russian change (deploy.md § Content auto-translation). The carlab en/sr
      guidance in `apps/auto-service/src/i18n/translateConfig.ts` changed
      ("Steer CarLab en/sr translations"), which changes the prompt fingerprint
      and retranslates every carlab en/sr string once, a paid one-off run
      (AGENTS.md § Architecture, "Editing the prompt or the model changes the
      fingerprint"). Do not run the translate scripts locally (AGENTS.md § Commands).
- [ ] Read sr and en on carlab.rs after that run, on a local build or the
      first deploy: home, services, works, contacts, about, thanks, 404, the
      parts hub, a category, a part page, search, the lead form and modal, the
      capture bot copy (`captureBot.yaml`). Serbian: case agreement and the
      formal "Vi" (AGENTS.md § i18n). Fix a translation in its own commit, never
      together with Russian (AGENTS.md § House style, "A hand-written translation
      survives on its own").
- [ ] No hand-written RU left in components:
      `grep -rP '[а-яА-ЯёЁ]' src/components src/pages src/layouts` in each app
      (AGENTS.md § i18n).
- [ ] Review the diff against AGENTS.md (AGENTS.md § Commands, "Review the diff").
- [ ] Open a PR `carlab-shop` → `release/<date>` (a new branch from `main`).
      The owner merges `release/<date>` into `main`; an agent never merges into
      `main`. This flow is the owner's rule, not written in the repository.
- [ ] Put the owner's manual steps (sections 3 to 9) in the PR description as a
      checklist. Owner's rule, not written in the repository.

## 3. VPS and shop backend

Do this **before** the merge: the merge ships the shop as soon as the four VPS
secrets exist (deploy.md § The first ship: a checklist, step 7). Steps 1 to 6
below are that checklist's steps 1 to 6. The Droplet, S3 and backup items are
one `terraform apply`: `infra/auto-service-shop/terraform/README.md`.

- [ ] Droplet in `fra1`: Ubuntu 24.04, `s-2vcpu-4gb` ($24, 4 GB), own ssh key;
      reserved IP assigned; the cloud firewall allows inbound 22/tcp, 80/tcp,
      443/tcp, 443/udp; no paid backups (§ The first ship, step 1;
      deploy.md § Easy to miss).
- [ ] Bootstrap: `sh bootstrap-host.sh` as `root`, then from a kept-open
      `deploy` session `sudo sh harden-ssh.sh [crawler.pub]`. Done when
      `ssh deploy@<IPv4>` works and `root` is refused (§ The first
      ship, step 2). The current `harden-ssh.sh` already writes the
      `Match User deploy` block for the Grafana tunnel; on a server hardened
      with an older copy, rerun it once (deploy.md § Logs: Events, Loki and Grafana).
- [ ] Check Docker's apt key fingerprint by hand:
      `gpg --show-keys /etc/apt/keyrings/docker.asc` (deploy.md § Easy to miss).
- [ ] DNS: A `api.carlab.rs` and `admin.carlab.rs` at the reserved IPv4; `dig +short`
      returns it (§ The first ship, step 3).
      Caddy then issues TLS for both hosts itself (`caddy/Caddyfile`).
- [ ] S3: public and private shop buckets, the shop's IAM user, the crawler's
      IAM user (private bucket only), versioning and lifecycle on the public
      bucket (deploy.md § Files on S3; § The first ship, step 5).
- [ ] Backup bucket (same region for now: the AWS organization allows only
      `eu-north-1`, deploy.md § The first ship, step 6), its own IAM user,
      `/srv/carlab/.env.backup` from `backup.env.example`, mode 600
      (deploy.md § Backup and restore; § The first ship, step 6).
- [ ] `/srv/carlab/.env` from `infra/auto-service-shop/production.env.example`,
      mode 600 (§ The first ship, step 4). Every name in the template:

  | Name                                                                                                                        | Value                                                                  | Source                    |
  | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------- |
  | `API_HOST`, `ADMIN_HOST`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `NODE_ENV`, `PORT`, `DATABASE_SSL`                       | keep the template's                                                    | `production.env.example`  |
  | `MEDUSA_TAG`                                                                                                                | leave empty; `deploy.sh` writes it                                     | deploy.md § `.env`        |
  | `POSTGRES_PASSWORD`, `TYPESENSE_API_KEY`, `JWT_SECRET`, `COOKIE_SECRET`, `CRAWLER_DB_PASSWORD`                              | `openssl rand -hex 32` each                                            | deploy.md § `.env`        |
  | `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_HASH`                                                                            | `caddy hash-password`; the hash in single quotes                       | deploy.md § `.env`        |
  | `OPENAI_API_KEY`, `IMPORT_CONCURRENCY`                                                                                      | the shop's own OpenAI key; keep the template's concurrency             | deploy.md § `.env`        |
  | `PUBLISH_DISPATCH_TOKEN`                                                                                                    | fine-grained token, `actions: write` on this repository, short expiry  | deploy.md § `.env`        |
  | `STOREFRONT_ORIGIN`                                                                                                         | `https://carlab.rs`                                                    | § The first ship, step 10 |
  | `SHOP_LEAD_SECRET`, `SHOP_CLIENT_SECRET`, `SHOP_ORDER_OUTCOME_SECRET`, `SHOP_EVENTS_SECRET`, `SHOP_VISITOR_SEARCHES_SECRET` | `openssl rand -hex 32` each; the same value goes to Vercel (section 5) | deploy.md § Shop Orders   |
  | `*_PREVIOUS` of those five                                                                                                  | empty (rotation only)                                                  | deploy.md § Shop Orders   |
  | `SHOP_OPEN`                                                                                                                 | `false`                                                                | deploy.md § Closed beta   |
  | `SHOP_PREVIEW_TOKEN`                                                                                                        | `openssl rand -hex 32`; same value on carlab.rs                        | deploy.md § Closed beta   |
  | `STORE_WRITES_PER_MINUTE`, `STORE_SEARCHES_PER_MINUTE`, `STOREFRONT_EVENTS_PER_MINUTE`, `LIVE_QUOTE_CACHE_SECONDS`          | keep the template's (120, 600, 1200, 60)                               | deploy.md § `.env`        |
  | `VIN_DECODERS`, `SUPPLIER_ADAPTERS`                                                                                         | keep the template's                                                    | deploy.md § `.env`        |
  | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID`                                                                                   | the CRM bot's values, as on Vercel                                     | deploy.md § `.env`        |
  | `FILE_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BUCKET`, `S3_PRIVATE_BUCKET`                | from the S3 step; `S3_ENDPOINT` empty for AWS                          | deploy.md § `.env`        |
  | `SENTRY_DSN`                                                                                                                | optional                                                               | deploy.md § Monitoring    |
  | `GRAFANA_ADMIN_PASSWORD`                                                                                                    | `openssl rand -hex 32`; required, compose refuses to start without it  | deploy.md § `.env`        |

- [ ] No value wrapped in `"…"` (deploy.md § Easy to miss, "`.env` is read literally").
- [ ] `stat -c %a /srv/carlab/.env` and `.env.backup` print `600`.
- [ ] Add the logrotate snippet for `/var/log/carlab-backup.log` (deploy.md § Easy to miss).
- [ ] Optional: crawler tunnel key on the Mac and `.env.crawler`
      (deploy.md § The crawler on the owner's Mac).

## 4. GitHub Actions secrets

Settings → Secrets and variables → Actions, **repository** secrets (deploy.md
§ GitHub Actions secrets).

- [ ] Already set: `OPENAI_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
      `VERCEL_PROJECT_ID`, `VERCEL_PROJECT_ID_AUTO_SERVICE`,
      `VERCEL_PROJECT_ID_DETAILING` (seen in `gh secret list`, 2026-11-02).
- [ ] CI's ssh key: `ssh-keygen -t ed25519`, public half in `deploy`'s
      `authorized_keys` with `restrict`; `ssh-keyscan -t ed25519 <IPv4>`,
      fingerprint verified separately (§ The first ship, step 7).
- [ ] Add `AUTO_SERVICE_SHOP_VPS_USER` (`deploy`), `AUTO_SERVICE_SHOP_VPS_SSH_KEY`,
      `AUTO_SERVICE_SHOP_VPS_KNOWN_HOSTS`, then `AUTO_SERVICE_SHOP_VPS_HOST`
      (the reserved IPv4) **last** (§ The first ship, step 7).
- [ ] Settings → Actions → General → Workflow permissions: Read and write; no
      tag protection rule covers `deployed/*` (deploy.md § Job permissions).

## 5. Vercel env per project

Production environment only; a change applies at the next deploy (deploy.md
§ A consequence: environment variables live in the Vercel project).

carlab.rs:

- [ ] `SHOP_LEAD_SECRET`, `SHOP_CLIENT_SECRET`, `SHOP_EVENTS_SECRET`,
      `SHOP_VISITOR_SEARCHES_SECRET`: the shop's values, server-only
      (deploy.md § Shop Orders).
- [ ] `SHOP_PREVIEW_TOKEN`: the shop's value, server-only, never `PUBLIC_`
      (deploy.md § Closed beta).
- [ ] `SHOP_OPEN`: `false` or unset. Only the exact `true` opens the storefront
      (deploy.md § Closed beta; § The first ship, step 11 says unset).
- [ ] `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY`: **not yet.** The key
      exists only after the shop's first deploy (section 7), and the build
      refuses `MEDUSA_BACKEND_URL` without the key
      (`apps/auto-service/src/utils/catalogueEnv.ts`).
- [ ] `CATALOGUE_SHRINK_ALLOWED`: unset (deploy.md § How it ships, step 5).
- [ ] Check present: `PUBLIC_PHONE_NUMBER`, `PUBLIC_WHATSAPP_NUMBER`,
      `PUBLIC_VIBER_NUMBER`, `PUBLIC_TG_MANAGER` (`carlabrs`), the
      `TELEGRAM_*` set incl. `TELEGRAM_CAPTURE_BOT_TOKEN` and
      `TELEGRAM_CAPTURE_WEBHOOK_SECRET`, `META_CAPI_TOKEN`, the Keystatic four,
      Blob connected (deploy.md § Environment variables).

approved.rs:

- [ ] `SHOP_API_URL` = `https://api.carlab.rs`, `SHOP_ORDER_OUTCOME_SECRET` and
      `SHOP_VISITOR_SEARCHES_SECRET` = the shop's values (deploy.md § Shop
      Orders; issue #442 "Env before the shop's first deploy").
- [ ] Optional `TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB` and
      `TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS` for owner replies in Topics
      (deploy.md § Telegram).

details.rs:

- [ ] Nothing new for this release in deploy.md. Check `PUBLIC_TG_MANAGER`
      (`approvedrs`) and the Telegram set as above.

Old names `SHOP_ORDER_HOOK_SECRET`, `SHOP_ORDER_HOOK_URL`, `MEDUSA_URL`,
`GITHUB_DISPATCH_TOKEN` and `PUBLIC_INSTAGRAM` are no longer read by any app
code on this branch; whether to delete them from Vercel is not documented; ask.

## 6. Merge and deploy

- [ ] The owner merges `release/<date>` into `main` (owner's rule).
- [ ] Watch Actions → CI on `main`: `check` → `translate` → `verify` →
      `shop-image` → `deploy-shop` → `record-shop`, with `deploy` (approved.rs)
      and `deploy-brand-site` (details.rs, carlab.rs) after; carlab.rs waits
      for `deploy-shop` (deploy.md § Job order; § How it ships).
      `gh run watch --repo Zikrasoft/approved_rs` follows it from a terminal.
- [ ] `verify` → `scope` log lists all four apps with "+ … will deploy"
      (`auto-service-shop` has no tag yet, the others changed packages)
      (deploy.md § Not everything gets deployed).
- [ ] `deploy-shop` green, `https://api.carlab.rs/health/ready` answers 200
      (§ The first ship, step 8). If `guard` says "secrets are not set", section 4
      is incomplete (deploy.md § GitHub Actions secrets).
- [ ] GHCR package linked to the repository with Actions read access (§ The
      first ship, step 8).
- [ ] Tags moved: `git ls-remote --tags origin 'deployed/*'` shows
      `approved-rs`, `detailing`, `auto-service` and `auto-service-shop` on the
      shipped SHA (deploy.md § The `deployed/*` tags). Never move one by hand.
- [ ] A `guard` line "is not set" is a configuration error; "is current in
      production" is normal (deploy.md § GitHub Actions secrets).
- [ ] This first carlab.rs build runs without `MEDUSA_BACKEND_URL`, so it has no
      shop catalogue until section 7; the live site returns 404 for
      `catalogue-build.json` today, so the build guard does not block it
      (`catalogueEnv.ts`). In that window `catalogueFromEnv` returns null, so
      `cataloguePagesForBuild` builds no category, make, model or part page,
      and the parts hub and search answer with the VIN inquiry form and the
      messenger tiles (`apps/auto-service/src/utils/catalogueEnv.ts`). Do
      section 7 straight away to shorten it.
- [ ] Nothing new in `data/leads-unreadable.json` and no admin alert about
      unreadable records after the first Leads (deploy.md § One Blob store
      shared by three projects).

## 7. After the first shop deploy

- [ ] Create an admin: `docker compose exec -T medusa node_modules/.bin/medusa user --invite`;
      sign in at `https://admin.carlab.rs` (basic_auth first) (§ The first ship, step 9).
- [ ] Settings → Publishable API Keys: create carlab.rs's key with the
      `CarLab parts shop` sales channel (§ The first ship, step 9).
- [ ] Check the eight seeded Categories, «Аккумуляторы» fields, registration
      service and price; upload its picture; the Suppliers screen lists the four
      crawled sites (§ The first ship, step 9). The seed runs on every deploy and
      fills new or unedited Categories and fields; anything with `updated_by`
      set is left alone (deploy.md § How it ships, production seed).
- [ ] carlab.rs Vercel: `MEDUSA_BACKEND_URL=https://api.carlab.rs`,
      `MEDUSA_PUBLISHABLE_KEY` = that key (§ The first ship, step 11).
- [ ] Crawler on the Mac, once: `pnpm exec playwright install chromium` in
      `apps/auto-service-shop`, `.env.crawler` from `.env.crawler.example`
      (values copied without printing them), the tunnel key, and
      `sudo sh /tmp/harden-ssh.sh /tmp/carlab-crawler.pub` on the server
      (deploy.md § The crawler on the owner's Mac).
- [ ] Start the tunnel, leave it open:
      `ssh -i ~/.ssh/carlab-crawler -N -L 15432:10.200.0.10:5432 crawler@<IPv4>`.
      In a second terminal start the worker:
      `pnpm --filter @podbor/auto-service-shop crawler`. deploy.md prefixes it with
      `caffeinate -i`; the owner's Mac is set never to sleep, so leave it off
      (deploy.md § The crawler on the owner's Mac).
- [ ] Per Supplier, in this order: a **test run** from the Suppliers screen (the
      number next to the button, for example 20 pages, picked at random across the
      sitemap) and check the stored pages; then the full crawl, **one site at a
      time**; then that Supplier's Import button. Import is separate from Publish,
      runs in the background and calls OpenAI (paid), so start the next Supplier
      only after the report of the last one is read (deploy.md § The shop backend;
      ADR-0048).
- [ ] A crawl that shows paused: the reason is on the Suppliers screen. A crawl
      paused as `worker_error` means the worker crashed five times in a row; read
      its log on the Mac, fix the cause, then press the button to resume (deploy.md
      § The shop backend). A stopped worker, a sleeping Mac or a dropped tunnel
      leaves the crawl `running` and it resumes by itself when the worker is back.
- [ ] `CRAWLER_FROM` stays unset until the owner names a mailbox the crawler's
      operators read (`TODO:` in `src/lib/crawler/worker.ts`); until then no `From`
      header is sent.
- [ ] Press **Publish** in the admin top bar. It calls OpenAI on the shop's
      `OPENAI_API_KEY` (paid), dispatches `publish.yml`, which rebuilds
      carlab.rs from `deployed/auto-service`, and reindexes search after the run
      succeeds (deploy.md § `.env`). The reindex is what builds the Typesense
      index with the current fields (`listed`, `measures`, `universal_facets` in
      `apps/auto-service-shop/src/search/part-identifier.ts`); search is empty
      until then (deploy.md § The server, "Typesense is not backed up").
- [ ] Done when `https://carlab.rs/sr/parts/brakes/` 301s to
      `/sr/parts/c/brakes/`, which answers 200 with text and picture (§ The
      first ship, step 11), and en/sr part, Category and car names read in
      their language (issue #442 "First production Publish").
- [ ] `CATALOGUE_SHRINK_ALLOWED=true` only for one intended shrink (a supplier
      removed), then remove it (deploy.md § How it ships, step 5).
- [ ] After the second Publish: check the Vercel build time and size, and that
      its log shows `(restored)` pages (issue #442, #380; ADR-0055).
- [ ] Acceptance: `docker stats --no-stream` within limits; a manual
      `/srv/carlab/backup.sh` ends with `Copied to the <bucket> bucket`;
      `backup.sh fetch` lists it; next morning the cron ran (§ The first ship, step 12).
- [ ] Restore drill once before the shop opens (deploy.md § Restore drill).
- [ ] Uptime monitor on `https://api.carlab.rs/health/ready` and Sentry
      (deploy.md § Monitoring).
- [ ] Closed-beta testers open `https://carlab.rs/api/shop-preview?token=<token>`
      once (deploy.md § Closed beta).

## 8. Telegram

- [ ] Webhooks registered: `getWebhookInfo` for the CRM bot and each capture
      bot shows `https://approved.rs/api/telegram-webhook` and
      `https://<domain>/api/telegram-capture`; register with
      `apps/approved-rs/scripts/register-webhook.ts crm|capture` if not
      (deploy.md § The Telegram webhooks). Not changed by this release as far
      as the docs say.
- [ ] Rerun the capture bot profiles for carlab.rs and details.rs after the
      translated `profile` copy reaches `main` (their `captureBot.yaml`
      `profile` texts changed on this branch):
      `cd apps/auto-service && node --env-file=.env.local --experimental-strip-types scripts/capture-bot-profile.ts`,
      same in `apps/detailing` (deploy.md § The capture bots' profile).
- [ ] `PUBLIC_TG_MANAGER` set per project, so the bot-or-manager choice and
      «Написать менеджеру» reach the manager (deploy.md § Public; AGENTS.md
      § House style, Telegram tile).
- [ ] Group: forum on; the CRM bot and the three capture bots are admins with
      **Manage topics** (deploy.md § The CRM bot).

## 9. Analytics

- [ ] GA4 key event `lead_modal_open` in the carlab.rs and details.rs
      properties (issue #442; analytics.md § The funnel lists it on approved.rs only).
- [ ] GA4 key events `search` and `search_suggestion_pick` in the carlab.rs
      property; they fire on carlab.rs only, and an event must be seen once
      before the toggle exists (analytics.md § How to add an event; AGENTS.md
      § Analytics, "all three GA4 properties"). Whether they should be key
      events at all is not documented; ask.
- [ ] Fire each once from the production build first, then Admin → Events →
      Mark as key event (analytics.md § How to add an event).
- [ ] Do not mark `add_to_cart`, `begin_checkout`, `purchase` yet: they are not
      fired while the shop is closed (analytics.md § The CarLab shop).
- [ ] Metrika: every goal reaches it under the same name (ADR-0044). Whether
      new goals must be created by hand in the Metrika counters is not
      documented; ask.
- [ ] Exclude internal visits before reading any number
      (docs/guides/analytics-exclusions.md).

## 10. Post-deploy smoke test

Mobile via DevTools device emulation, desktop with a mouse.
`node --experimental-strip-types scripts/contact-controls-pass.ts https://carlab.rs /sr/ /sr/parts/`
checks both pointer variants (AGENTS.md § House style, "A `tel:` control only
exists where a dialer does").

All three domains (deploy.md § Post-deploy checks):

- [ ] `/` redirects to `/<locale>/`; HTTPS active.
- [ ] No `undefined` in Telegram/WhatsApp/Viber/phone links.
- [ ] A form lead reaches the CRM group with the right brand name; a call or
      messenger tap reaches it via `/api/contact-click`.
- [ ] `/keystatic` signs in; `curl -o /dev/null -w '%{http_code}' https://<domain>/api/keystatic/github/login` prints 307.
- [ ] approved.rs: bot DM buttons work; all three brands' Leads visible.

carlab.rs:

- [ ] `https://carlab.rs/sr/` hero: on touch a `tel:` call, on a mouse a
      callback button that opens the lead modal titled for a callback; Google
      rating shown (commit subjects; `src/components/HeroContacts.astro`).
- [ ] Lead form (inline and modal) needs only a contact; submit lands on
      `/sr/thanks/` and a card appears in the CRM chat with brand CarLab
      (AGENTS.md § House style, "Only the contact is required").
- [ ] `https://carlab.rs/sr/parts/`: VIN search resolves a car; a part-number
      search finds a part; a zero-result search offers the call and the inquiry.
- [ ] A category page `/sr/parts/c/<slug>/`: filters recount, «Для моего авто»
      make/model picker narrows the list, zero results lead to an inquiry.
- [ ] A part page `/sr/parts/p/<slug>/`: order panel ends in an inquiry; no
      price, no stock, no cart anywhere (view source too: no Offer JSON-LD)
      (deploy.md § Closed beta).
- [ ] `/sr/parts/cart/` redirects to the inquiry form without the preview cookie
      (deploy.md § Closed beta).
- [ ] `https://carlab.rs/llms.txt` answers 200 directly (no redirect), names no
      cart, states the Google rating (AGENTS.md § House style, `/llms.txt`;
      deploy.md § Closed beta).
- [ ] Redirects: `/sr/parts/brakes/` → `/sr/parts/c/brakes/`;
      `/sr/parts/c/<slug>/1/` → `/sr/parts/c/<slug>/` (301)
      (`apps/auto-service/vercel.json`).
- [ ] `https://carlab.rs/catalogue-build.json` counts part pages after Publish
      (deploy.md § How it ships, step 5).
- [ ] `/api/csp-report` lines `[csp] …` appear in Vercel logs only for real
      violations (deploy.md § Vercel builds nothing).

Shop:

- [ ] `https://api.carlab.rs/health/ready` 200; `https://api.carlab.rs/admin`
      404; `https://admin.carlab.rs` asks for basic_auth (deploy.md § `.env`).
- [ ] Grafana: `ssh -N -L 3000:127.0.0.1:3000 deploy@<server>`, open
      `http://localhost:3000`, sign in as `admin`; the **CarLab shop** dashboard
      has data after a search on carlab.rs; `curl -sI http://<server>:3000` from
      outside times out (deploy.md § Logs: Events, Loki and Grafana).
- [ ] `ssh deploy@<server> /srv/carlab/logs-export.sh` prints the two export
      paths (same section).

## 11. Rollback

- Shop image: note `cat /srv/carlab/.previous-tag` first, then
  `ssh deploy@<IPv4> '/srv/carlab/deploy.sh "$(cat /srv/carlab/.previous-tag)"'`
  **once**. Migrations do not roll back: if the schema changed, restore the
  `db-<stamp>-pre-deploy.dump` instead. Delete the `deployed/auto-service-shop`
  tag once the fix is in `main` (deploy.md § Rollback). On this first ship
  there is no previous tag.
- Shop down: carlab.rs deploys are skipped with a warning and the live site
  keeps serving; a Publish fails (deploy.md § How it ships, step 5).
- A Vercel site: not documented for this repo beyond redeploying from git;
  ask (Vercel dashboard rollback is not covered in deploy.md). To redeploy one
  site from `main`: `git push origin :refs/tags/deployed/<app>`, then Actions →
  CI → Run workflow (deploy.md § The `deployed/*` tags).
- Close prices again: `SHOP_OPEN` anything but `true` on both sides, restart
  the shop, rebuild carlab.rs (deploy.md § Closed beta).

## 12. Weekly routine

- [ ] `ssh deploy@<server> /srv/carlab/logs-export.sh`, then
      `scp 'deploy@<server>:/srv/carlab/exports/carlab-events-*' .` and hand
      both files to Claude; keep them out of the repo and public chats
      (deploy.md § Logs: Events, Loki and Grafana).
- [ ] Refresh `GOOGLE_RATING` (`rating`, `reviews`, `checkedOn`) in
      `apps/auto-service/src/utils/constants.ts` from the Google Maps card of
      `GARAGE_ADDRESS.googleMapsCid`; nothing updates it (the `TODO:` there).
      `llms.txt` reads it through `src/utils/llmsTxt.ts`. The weekly cadence
      is not documented; ask.
- [ ] Check Loki disk: `docker system df -v | grep carlab_lokidata` (deploy.md
      § Logs). The interval is not documented.

## 13. Open owner items

Issue #442 ("Release prep: owner decisions for carlab.rs"), open:

- [ ] [feature] Parts guarantee / returns wording.
- [ ] [feature] Reviews or rating on the parts path.
- [ ] [feature] Installation service per Category mapping.
- [ ] [bug] Social account URLs per brand, incl. details.rs Instagram.
- [ ] [feature] Telegram tile on the order confirmation tied to the order.
- [ ] [feature] VIN and decode retention period.
- [ ] [feature] Where Leads live long term (archive blob or Postgres).
- [ ] [feature] VPS sizing before the full catalogue import.
- [ ] [bug] Analytics before consent: opt-out or opt-in.
- [ ] [feature] Spam protection on forms (Vercel Firewall rules or Turnstile).
- [ ] [feature] The «обычно в течение часа» promise.
- [ ] [feature] Env before the shop's first deploy (sections 3 and 5).
- [ ] [feature] First production Publish with the OpenAI key (section 7).
- [ ] [feature] GA4 key event `lead_modal_open` (section 9).
- [ ] [feature] #380 build time and `(restored)` pages (section 7).
- [ ] [feature] #268 keyword research access.
- [ ] Comments: [bug] servicing duration («1 день» vs «2–4 часа»); [bug]
      service prices in € vs parts in RSD; [bug] works slugs and titles;
      [feature] cheaper equivalent on a priced OE page; [bug] «В наличии,
      забрать завтра» meaning.

Content, from `TODO:` markers in `apps/auto-service`:

- [ ] Parking and the entrance (`src/content/i18n/site.yaml`).
- [ ] Usual booking lead time (`src/content/i18n/home.yaml`).
- [ ] Team for About; the block stays hidden while `team` is empty
      (`src/content/i18n/pages.yaml`).
- [ ] Google rating refresh (section 12).
- [ ] The brake work's car name: `src/content/works/obsluzhivanie-tormoznoj-sistemy`
      has `car: Обслуживание тормозной системы`, a service, not a car.
- [ ] Larger photo originals: raised in this session; not tracked in the
      repository.

## 14. Catalogue build size and time

carlab.rs is static: every Part has a page in each of its three locales (ru, sr,
en), plus Model, Vehicle, Model x Category, Category and Make pages. The catalogue
is read from the shop in pages, and `experimental.incrementalBuild` copies a page
whose data did not change from the cache (ADR-0055). The catalogue's real size is
not recorded anywhere in the repository; measure it before trusting a number.

- [ ] After the first full Import, count the Parts and the part pages
      (`https://carlab.rs/catalogue-build.json` after the first Publish, deploy.md
      § How it ships, step 5). The estimate is Parts x 3 plus the hubs.
- [ ] First Publish: note the wall-clock time of the `rebuild-carlab` job in
      `publish.yml`, the page count and the size of the `astro-carlab-*` cache
      (`gh cache list`). This run has an empty cache and is the slowest.
- [ ] Second Publish after a small change: its log shows `(restored)` pages and
      the time drops (ADR-0055; issue #380).
- [ ] The admin's Publish chain stops waiting after 90 minutes and then does not
      reindex search (deploy.md § `.env`). The workflow itself keeps running, so a
      build near that limit needs a manual reindex or a longer limit.
- [ ] Not verified, check before the catalogue is large: GitHub Actions' cache
      size limit per repository against the size of `node_modules/.astro`, and
      whether Vercel accepts a `vercel deploy --prebuilt --archive=tgz` with
      100 000 or more output files (the limits page documents 15 000 files for
      source uploads of CLI deployments and says nothing for prebuilt output;
      https://vercel.com/docs/limits).
- [ ] If the build is too slow, the options in rising cost: publish only part of
      the Parts (the `listed` flag already exists on published numbers,
      `src/modules/catalog/cross-module-sql.ts`; how it affects the build has not
      been checked); build Part pages in fewer locales; raise the 90 minute wait;
      render the long tail on request instead of at build time. The last one
      reverses ADR-0020, which declined ISR as paid, so it needs an owner decision.
