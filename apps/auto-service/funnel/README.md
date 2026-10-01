# The funnel walk

A browser drives the real storefront against a real Medusa: product card → cart
→ checkout, and then reads what the system wrote — the development filesystem
Lead store and the Order marker directory. Telegram is intercepted at the
network boundary, so the real notify path runs and a delivery failure can be
forced.

**Local only. Never a CI job** (decided on #86): the stack is too heavy for the
value. CI's only involvement is `astro check`, which typechecks
`funnel/*.spec.ts` and `playwright.config.ts` along with the rest of the app —
so a renamed import breaks the existing check job. Browser binaries are never
installed in CI.

## Prerequisites

### 1. Postgres and Redis for Medusa

```bash
docker compose -f apps/medusa/docker-compose.test.yml up -d --wait
```

### 2. `apps/medusa/.env`

Copy `.env.example` and set, at least:

| Variable                 | Value                                                     |
| ------------------------ | --------------------------------------------------------- |
| `PORT`                   | `9009`                                                    |
| `DATABASE_URL`           | `postgres://postgres:postgres@localhost:55432/medusa`     |
| `REDIS_URL`              | `redis://localhost:56379`                                 |
| `STORE_CORS`             | `http://localhost:4322` — the port the walk serves on     |
| `ADMIN_URL`              | an **https** URL; `orderHookSchema` refuses anything else |
| `SHOP_ORDER_HOOK_URL`    | `http://localhost:4322/api/shop-order`                    |
| `SHOP_ORDER_HOOK_SECRET` | the same ≥32-character secret as the storefront           |

### 3. Migrate, seed, run

```bash
pnpm --filter @podbor/medusa db:migrate
pnpm --filter @podbor/medusa seed
pnpm --filter @podbor/medusa seed:batteries   # the walk buys a battery
pnpm --filter @podbor/medusa develop          # the script is `develop`, not `dev`
```

`seed:batteries` prints the publishable key (`Publishable key: pk_…`). A fresh
database means a fresh key — put it in `apps/auto-service/.env.local` as
`PUBLIC_MEDUSA_PUBLISHABLE_KEY`, or the storefront talks to Medusa with the key
of a database that no longer exists.

### 4. `apps/auto-service/.env.local`, exported into the shell

`astro dev` does not put unprefixed `.env` variables into `process.env`, and the
walk reads them before it starts anything, so export them:

```bash
set -a; . apps/auto-service/.env.local; set +a
```

Required, or the walk refuses to start and names what is missing:
`PUBLIC_MEDUSA_BACKEND_URL`, `PUBLIC_MEDUSA_PUBLISHABLE_KEY`,
`SHOP_ORDER_HOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID`,
`TELEGRAM_BOT_USERNAME`. The bot token is never used against the real API — the
walk intercepts `api.telegram.org` — but `src/lib/crmBot.ts` demands it at
module load.

### 5. The browser, once per machine

```bash
pnpm --filter @podbor/auto-service exec playwright install chromium
```

## Running it

```bash
cd apps/auto-service && pnpm exec playwright test
```

The walk starts its own `astro dev` on port 4322 (`FUNNEL_PORT` overrides it)
and stops it again. It never reuses a dev server that is already running,
because a server started without the Telegram interception would send cards to
the real chat — so stop your own `pnpm dev` first, or `astro dev` refuses the
lock and the walk fails with that message.

`.local-data/` is wiped when the walk starts and left in place when it ends, so
the Leads, the Order markers and the intercepted Telegram calls can be read
afterwards:

```
.local-data/data/leads.json          the Lead store
.local-data/shop-orders/<id>.json    one Order marker per Order
.local-data/funnel/telegram.jsonl    every intercepted Telegram call
.local-data/funnel/telegram-fail     present ⇒ the next call is refused
```

## What it asserts

1. **One order.** Exactly one Lead, exactly one Order marker, and exactly one
   `sendMessage` to the group — with the operator card's payload: the group
   chat, HTML parse mode, the buyer's name, the `parts-order` service and a
   deep link carrying the stored Lead's id. The Lead itself carries
   `brand: CarLab`, `service: parts-order`, `visitorId: null`, the E.164 phone
   and a comment naming the order number.
2. **A refused card.** With the fail switch on, the order's card is refused, the
   Lead is still stored and the marker is still held. A second signed hook for
   the same Order answers `200 {duplicate: true}`, writes no second Lead, takes
   no second marker and sends no second card.

## Three things worth knowing about the mechanics

- Telegram is intercepted by `NODE_OPTIONS=--import funnel/telegramStub.ts`,
  which patches `globalThis.fetch` inside the dev server's own process — the
  calls are made server-side, so Playwright's request interception cannot see
  them.
- The walk opens the first product page once before it buys anything, and the
  add-to-cart click is retried: on a cold `node_modules/.vite` the dev server
  discovers `libphonenumber-js` mid-walk and reloads the page under the browser,
  which used to fail the first run on a fresh clone.
- `SHOP_STATUS` is forced to `live` for the walk's dev server, and
  `ASTRO_DEV_BACKGROUND=1` is set to keep `astro dev` in the foreground: Astro 7
  detects an agent environment and daemonizes otherwise, which Playwright reads
  as the server having exited.

## What this layer cannot prove

- **Nothing, after the fact.** It is local-only, so it gives no regression
  protection; the automated floor for exactly-once stays the integration layer.
- The 502 the storefront returns to Medusa is observed only through its cause
  and its consequences. The walk sees the refused Telegram call and the held
  marker; the response code itself goes to Medusa.
- The retry is a second signed hook for the same Order, issued by the walk.
  Medusa's own event-bus retries fire too and are equally absorbed, but their
  timing is the bus's, not the walk's.
- It walks `ru` only, one battery, one quantity, no installation service, and no
  payment provider other than the system default.
