# CarLab shop: local demo with a fake supplier

A private, reproducible stack for walking the parts shop end to end in a
browser: admin data entry, the supplier import, VIN, search, part pages, cart,
order, and the Lead that order produces. Everything runs on your machine. No
Telegram, no OpenAI, no GitHub dispatch.

It does not touch the shared test stack (`podbor-carlab-shop`, ports 55432 and
58108). The demo uses its own containers on 55444 and 58444.

## Run it

```bash
pnpm dev:shop
```

One command, on a fresh clone or an existing setup. It builds the CommonJS
workspace packages, then `shop:prepare` (`apps/carlab-shop/scripts/shop-prepare.sh`):

- creates `apps/carlab-shop/.env` with the demo values below and random JWT and
  cookie secrets, only if the file is missing;
- creates `apps/auto-service/.env.local` from `.env.example` if missing, and
  fills the Telegram placeholders (`TELEGRAM_BOT_TOKEN=1:fake`,
  `TELEGRAM_BOT_USERNAME=demo_crm_bot`, `TELEGRAM_GROUP_ID=-1`,
  `TELEGRAM_OWNER_ID=1`, `TELEGRAM_ADMIN_ID=2`) where a key is absent or empty,
  leaving every other line alone;
- creates `apps/carlab-shop/.local-demo/supplier-overrides.json` (`{}`, see
  step 7);
- starts Postgres (55444) and Typesense (58444) from
  `apps/carlab-shop/docker-compose.demo.yml` (project `carlab-demo`, named
  volumes), replacing `carlab-demo-pg` / `carlab-demo-ts` containers left over
  from a hand-run `docker run`;
- runs `db:migrate`, `seed:demo` and `publish:local`, all safe to rerun.

Then it runs `medusa develop` on 9009 and, once `/health` answers, `astro dev`
on 4321 with `.env.local` loaded into `process.env`. Ctrl-C stops both; the
containers stay up. The root `pnpm dev` starts none of this.

Start over with an empty database:

```bash
docker compose -f apps/carlab-shop/docker-compose.demo.yml down -v
```

The sections below are what the command does, for reference.

## 1. Postgres and Typesense

`docker compose -f apps/carlab-shop/docker-compose.demo.yml up -d --wait`.

## 2. Backend environment (`apps/carlab-shop/.env`, gitignored)

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
| `LEAD_ROUTE_URL`          | `http://127.0.0.1:4321/api/leads`                     |

`LEAD_ROUTE_URL` names `127.0.0.1`, not `localhost`: Node resolves `localhost`
to `[::1]` first, and anything else listening on IPv6 port 4321 gets the
order. `shop:prepare` rewrites a `localhost` value left in an existing `.env`.

Leave `OPENAI_API_KEY` and `PUBLISH_DISPATCH_TOKEN` unset.
`SUPPLIER_ADAPTERS=demo` is refused when `NODE_ENV=production`.

## 3. Migrate and seed

`pnpm db:migrate` and `pnpm seed:demo` in `apps/carlab-shop`. `seed:demo` is
idempotent per part: rerunning it keeps the admin, reuses the key, skips
the catalogue once the demo suppliers exist, skips the batteries once the
`batteries` Category exists, skips the filter variety once `oil-filters` has a
`height` field, and adds any supplier category mapping or brand spelling the
demo catalogue gained since. An existing demo database picks up the batteries
and the filter variety on the next `pnpm dev:shop`; a part the import already
created under one of the variety's numbers is classified rather than created
twice.

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
  multi-select, volume; maintenance kit, rank 0), `oil-filters` (filter type
  cartridge/spin-on, height mm, outer diameter mm, thread as a text code such
  as `M20x1.5` or `3/4-16 UNF`, gasket included; all filters; kit, rank 1) and
  `brake-pads` (required axle, thickness mm, wear sensor included / prepared /
  none; all filters).
- `batteries` (capacity Ah, cold cranking EN A, voltage, technology
  standard/EFB/AGM, polarity, case size H5/L2 to H9/L6, length, width, height
  mm; not a maintenance kit category). It sells one add-on service with every
  battery: «Регистрация аккумулятора в блоке управления (в сервисе CarLab)»
  for 2 500 RSD, editable in the admin's Categories page.
- Requirements: B47 needs 5W-30 or 0W-30 and BMW LL-04 (one 5 l can); OM654
  needs MB 229.51 or 229.52 (7 l, so two 5 l cans). A Requirement's quantity
  counts Parts to buy, never litres. Batteries: B47 needs AGM, at least 80 Ah
  and 800 A, reverse polarity, case H7/L4 or H8/L5; OM654 needs AGM and at
  least 80 Ah.
- Parts and Fitments: the B47 oil filter with four numbers (one superseded,
  `11 42 8 507 683`), the OM654 filter, front pads and M Sport front pads on
  the 320d (two Parts plus a note: an ambiguous position), rear pads, an old
  front pad replaced by the current one, two oils, left- and right-hand-drive
  wiper sets on the E-class (the steering-specific candidates), and an oil
  pressure sensor with no Category or Fitment (not enriched).
- Filter variety: the B47 and OM654 oil filters and the four existing pads get
  those attributes, and new Parts without Fitments join them: oil filters Mann
  W 712/75 and W 610/3, Mahle OC 90, Bosch F 026 407 236, Hengst H90W24 and
  E340H D247, Knecht OX 371D, Febi 27150 (ten oil filters in all); pads Brembo
  P 06 038 and P 06 087, Zimmermann 23921.200.1, Textar 2412201, TRW GDB1919,
  ATE 13.0460-7230.2 (ten pads). Brands Hengst, Knecht, Febi, Brembo and
  Zimmermann are added. They give the storefront's brand, «Только в наличии»
  and price filters something to narrow; no Requirement or maintenance kit
  changes.
- Five batteries: Varta Silver Dynamic AGM G14 80 Ah (`580 901 080`) and Bosch
  S5 A13 AGM 95 Ah (`0 092 S5A 130`) fit both cars; Exide AGM EK700 70 Ah is
  too small, Varta Blue Dynamic EFB N80 is EFB, Exide Excell EB741 is a
  standard battery with straight polarity and no offer (price on request).
- Two Suppliers, `Demo Intercars` (20%) and `Demo Autodelovi` (10%), with their
  category codes mapped and their brand spellings.

## 4. Import, translate, reindex (the publish chain, locally)

```bash
pnpm publish:local
```

It runs the supplier import, skips translate when `OPENAI_API_KEY` is unset,
and reindexes Typesense. The deploy step is left out: `publish.yml`
rebuilds production, and locally "deploy" means rebuilding the storefront (step 6).

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
| Batteries, one out of stock (Bosch S5 A13)            | IC-1012 to IC-1015                                                     |
| Filter variety: priced, out of stock, several brands  | IC-1101 to IC-1107, AD-2101 to AD-2104                                 |
| Variety Parts with no offer (price on request)        | Mann W 610/3, Hengst E340H D247, Brembo P 06 087                       |

Staged data stays hidden until a Supplier releases the kind in the admin's
Suppliers page.

## 5. Backend

`pnpm dev:shop` in `apps/carlab-shop` (`medusa develop`). Admin:
<http://localhost:9009/app>. Store API: <http://localhost:9009/store/...> with
the `x-publishable-api-key` header.

`medusa develop` does not restart on file changes when the checkout path
contains a dot directory (a `.claude/worktrees/...` worktree): restart it by
hand after backend edits there.

## 6. Storefront

`astro dev` does not put `.env.local` into `process.env`, and the lead route
reads the Telegram variables from there, so `dev:shop` starts it under
`node --env-file-if-exists=.env.local`. The placeholders are enough: the Lead
is stored in `apps/auto-service/.local-data/data/leads.json` (gitignored) and
the Telegram notification fails in the log. The Astro config fetches the part
pages from Medusa at load, so the storefront waits for the backend.

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
- Filters: `/ru/parts/c/oil-filters/` and `/ru/parts/c/brake-pads/` offer
  brand, «Только в наличии» and price beside the Category's own fields; a
  filter whose every result shares one value is hidden. Brand, stock and price
  come from the search index, so they follow offers at the next reindex
  (`publish:local`), not on a live quote.
- Battery with the registration add-on: `/ru/parts/p/varta-580901080/`; the
  E-class car page lists the matching batteries.
- Cart: `/ru/parts/cart/`.

## 7. Stale price and stock drop

The overrides file is whatever `DEMO_SUPPLIER_OVERRIDES` in the backend's env
names. `shop:prepare` points a new `apps/carlab-shop/.env` at
`apps/carlab-shop/.local-demo/supplier-overrides.json`; an existing `.env`, or
a backend started with another env file, keeps its own path, so check it first:

```bash
grep DEMO_SUPPLIER_OVERRIDES apps/carlab-shop/.env
```

The demo adapter rereads the file on every quote, so edits apply on the next
page view or cart action, no restart:

```json
{ "IC-1001": { "cost_price": 1300 }, "AD-2002": { "stock": 0 } }
```

`cost_price` simulates a price change since the import, `stock` replaces the
article's stock (one location). A missing file means no overrides; a malformed
one makes the quote fail, which the shop treats as no live offer. Write `{}`
to go back to the catalogue prices.

## 8. Manual offer

For a number no supplier quotes, a manager enters the offer by hand: admin
«Запчасти», the row's «...» menu, «Предложения». The drawer lists every offer of
that brand-number (source, purchase price, storefront price after markup,
stock, lead time, who changed it last) and holds one manual offer per number:
purchase price in RSD, stock, lead time in days (stock above 0 or a lead time
is required). Save, edit and delete apply to the manual offer only.

The manual offer belongs to the Supplier `manual` («Ручной ввод» in the
admin), created on the first save with a 20% markup; change the markup under
«Поставщики». Imports never touch it, its live quote is the stored row, and the
search index picks it up at once; the static part pages show it after the next
Publish (`publish:local`). The same write path is
`saveManualOffer(scope, partIdentifierId, offer, actorId)` in
`apps/carlab-shop/src/lib/suppliers/manual-offers.ts`, for a future file
import. Over HTTP: `POST` / `DELETE`
`/admin/part-identifiers/:id/manual-offer`, `GET
/admin/part-identifiers/:id/offers`.

## 9. Stop

Ctrl-C `pnpm dev:shop`, then
`docker compose -f apps/carlab-shop/docker-compose.demo.yml stop` (or `down -v`
to drop the data).
