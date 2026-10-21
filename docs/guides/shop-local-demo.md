# CarLab shop: local demo with a fake supplier

A private, reproducible stack for walking the parts shop end to end in a
browser: admin data entry, the supplier import, VIN, search, part pages, cart,
order, and the Lead that order produces. Everything runs on your machine. No
Telegram, no OpenAI, no GitHub dispatch.

It does not touch the shared test stack (`podbor-carlab-shop`, ports 55432 and
58108). The demo uses its own containers on 55444 and 58444.

## 1. Postgres and Typesense

```bash
docker run -d --name carlab-demo-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=medusa \
  -p 127.0.0.1:55444:5432 postgres:16.15-alpine
docker run -d --name carlab-demo-ts -p 127.0.0.1:58444:8108 \
  typesense/typesense:30.2 --data-dir /tmp --api-key=xyz
```

Typesense keeps its data inside the container: removing it drops the index,
and `publish:local` (step 4) rebuilds it.

## 2. Backend environment

Export these into the shell that runs `apps/carlab-shop` commands (never
commit them; a `.env` there is gitignored if you prefer a file):

| Name                      | Demo value                                            |
| ------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`            | `postgres://postgres:postgres@127.0.0.1:55444/medusa` |
| `JWT_SECRET`              | any string                                            |
| `COOKIE_SECRET`           | any string                                            |
| `STORE_CORS`              | `http://localhost:4321`                               |
| `ADMIN_CORS`, `AUTH_CORS` | `http://localhost:9009`                               |
| `TYPESENSE_PORT`          | `58444`                                               |
| `PORT`                    | `9009` (Medusa reads it itself; unset it is 9000)     |
| `SUPPLIER_ADAPTERS`       | `demo`                                                |
| `DEMO_SUPPLIER_OVERRIDES` | an absolute path to a JSON file, see step 7           |
| `LEAD_ROUTE_URL`          | `http://localhost:4321/api/leads`                     |

Leave `OPENAI_API_KEY` and `PUBLISH_DISPATCH_TOKEN` unset.
`SUPPLIER_ADAPTERS=demo` is refused when `NODE_ENV=production`.

## 3. Migrate and seed

The storefront needs its public variables before the build, so copy the
example first; the seed then adds the backend URL and the publishable key.

```bash
pnpm turbo run build --filter=@podbor/i18n --filter=@podbor/brands --filter=@podbor/catalog-contract --filter=@podbor/lead-crm
cp apps/auto-service/.env.example apps/auto-service/.env.local
cd apps/carlab-shop
pnpm db:migrate
pnpm seed:demo
```

`seed:demo` is idempotent per part: rerunning it keeps the admin, reuses the
key and skips the catalogue once the demo suppliers exist. To start over, drop
the containers and begin at step 1.

What it creates:

- Admin `admin@carlab.local` / `carlab-demo` (printed to the terminal; a local
  demo credential, nothing else uses it).
- A publishable key, written as `MEDUSA_PUBLISHABLE_KEY` (plus
  `MEDUSA_BACKEND_URL`) into `apps/auto-service/.env.local`, only because that
  file is gitignored. Other lines in the file are kept.
- BMW: 3 and 5 series, F30 and G30, 320d (B47), 320i (B48), 520d (B47), with
  type codes `35BG`, `8E31`, `JA31`. Mercedes-Benz: E-class W213 E 220 d
  (OM654), Baumuster `213004`.
- The seven placeholder Categories, plus `engine-oil` (viscosity, approvals
  multi-select, volume; maintenance kit, rank 0), `oil-filters` (filter type;
  kit, rank 1) and `brake-pads` (required axle).
- Requirements: B47 needs 5W-30 or 0W-30 and BMW LL-04 (one 5 l can); OM654
  needs MB 229.51 or 229.52 (7 l, so two 5 l cans). A Requirement's quantity
  counts Parts to buy, never litres.
- Parts and Fitments: the B47 oil filter with four numbers (one superseded,
  `11 42 8 507 683`), the OM654 filter, front pads and M Sport front pads on
  the 320d (two Parts plus a note: an ambiguous position), rear pads, an old
  front pad replaced by the current one, two oils, left- and right-hand-drive
  wiper sets on the E-class (the steering-specific candidates), and an oil
  pressure sensor with no Category or Fitment (not enriched).
- Two Suppliers, `Demo Intercars` (20%) and `Demo Autodelovi` (10%), with their
  category codes mapped and their brand spellings.

## 4. Import, translate, reindex (the publish chain, locally)

```bash
pnpm publish:local
```

It runs the supplier import, skips translate when `OPENAI_API_KEY` is unset,
and reindexes Typesense. The deploy step is left out: there is no
`publish.yml`, and locally "deploy" means rebuilding the storefront (step 6).

The admin's Publish button runs the real chain and, without an OpenAI key,
stops at `translate` with "OPENAI_API_KEY is not set" once any row is
untranslated. That is expected here. `POST /admin/supplier-imports` (import
only) works from the admin.

What the demo catalogue exercises (`src/lib/suppliers/demo-adapter.ts`, three
articles per page):

| Case                                                  | Article(s)                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Unmapped supplier category, skipped                   | IC-1008, AD-2006                                                       |
| Brand with no spelling, skipped                       | IC-1007 (`NONAME PARTS`), AD-2006 (`Bosch`)                            |
| Alias spellings of one Brand                          | `MANN`, `MANN-FILTER`, `Mann Filter`                                   |
| Odd spacing, dots, dashes, case                       | `11.42.8.575.211`, `OX-404-D`, `hu 6020 z`                             |
| New Part created by the import                        | IC-1009 (air filter), IC-1011 (rear pad, no axle: lands uncategorised) |
| In-stock beats a cheaper out-of-stock                 | HU 816 x: IC-1001 (in stock) over AD-2001                              |
| Cheaper in-stock wins                                 | HU 6020 z: AD-2005 over IC-1002                                        |
| Equal price, shorter lead time first                  | ATE 13.0460-2786.2: AD-2002 over IC-1003                               |
| EUR quote dropped                                     | IC-1006 (Mahle OX 404D)                                                |
| Staged data (cross references, applicability, images) | IC-1001, IC-1003, IC-1009, AD-2004                                     |

Staged data stays hidden until a Supplier releases the kind in the admin's
Suppliers page.

## 5. Backend

```bash
pnpm develop
```

Admin: <http://localhost:9009/app>. Store API: <http://localhost:9009/store/...>
with the `x-publishable-api-key` header.

`medusa develop` does not restart on file changes when the checkout path
contains a dot directory (a `.claude/worktrees/...` worktree): restart it by
hand after backend edits there.

## 6. Storefront

`astro dev` does not put `.env.local` into `process.env`, and the lead route
reads the Telegram variables from there, so export the file first. Placeholder
Telegram values are enough: the Lead is stored in
`apps/auto-service/.local-data/data/leads.json` (gitignored) and the Telegram
notification fails in the log.

In `apps/auto-service/.env.local` set `TELEGRAM_BOT_TOKEN=1:fake`,
`TELEGRAM_BOT_USERNAME=demo_crm_bot`, `TELEGRAM_GROUP_ID=-1`,
`TELEGRAM_OWNER_ID=1`, `TELEGRAM_ADMIN_ID=2`, then:

```bash
cd apps/auto-service
set -a; . ./.env.local; set +a
pnpm exec astro dev --port 4321
```

Storefront: <http://localhost:4321/ru/parts/>. Leads only reach the local file
under `astro dev`; a production build writes to Vercel Blob.

To check the build against the demo backend, export the storefront variables
first: the sitemap reads `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY`
from the environment (turbo passes only those two through), and without them it
lists no part pages.

```bash
set -a; . apps/auto-service/.env.local; set +a
pnpm turbo run build --filter=@podbor/auto-service
python3 -m http.server 4322 --bind 127.0.0.1 --directory apps/auto-service/.vercel/output/static
```

`astro preview` does not run with the Vercel adapter, so the static server
shows the prerendered pages only (no `/api/*`). Rebuild after every import to
see new Parts on static pages.

Useful pages:

- Owner VIN: post `WBA35BG070N074158` in the VIN form, or open the car page it
  redirects to (`/ru/parts/car/<vehicle id>/`).
- E-class: `WDD2130041A123456` (left-hand drive) and `WDD2130042A123456`
  (right-hand drive; the redirect carries `?steering=right`).
- Part page: `/ru/parts/p/mann-filter-hu816x/`; superseded number:
  `/ru/parts/p/bmw-11428507683/`; replaced Part: `/ru/parts/p/ate-13046072172/`.
- Search: `/ru/parts/search/?q=hu816x`; car hub: `/ru/parts/bmw/f30-320d/`.
- Cart: `/ru/parts/cart/`.

## 7. Stale price and stock drop

The demo adapter rereads `DEMO_SUPPLIER_OVERRIDES` on every quote, so edits
apply on the next page view or cart action, no restart:

```json
{ "IC-1001": { "cost_price": 1300 }, "AD-2002": { "stock": 0 } }
```

`cost_price` simulates a price change since the import, `stock` replaces the
article's stock (one location). A missing file means no overrides; a malformed
one makes the quote fail, which the shop treats as no live offer. Write `{}`
to go back to the catalogue prices.

## 8. Stop

```bash
cd apps/auto-service && pnpm exec astro dev stop
docker rm -f carlab-demo-pg carlab-demo-ts
```

Stop `pnpm develop` and the static server with Ctrl-C (or by PID).
