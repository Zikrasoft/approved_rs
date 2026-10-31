---
status: accepted
---

# The CarLab shop runs on Medusa 2.19, self-hosted on one Hetzner VPS

In `main` since PR #34; the VPS is not ordered yet.

The shop needs several product types with their own cards and filters, stock, orders with statuses, and later online payment and delivery. It is built on Medusa 2.19 as `apps/medusa` inside this monorepo (sharing the catalog registry, order hook and translator with the sites), with staywildwear (Medusa + static Astro + custom elements) as the reference. It runs on a Hetzner CX23 (4 GB, ≈€7.7/month; CPX22 as fallback) under docker compose: Postgres 16, Redis 7, Medusa, Caddy on `api.carlab.rs`, product files on a local volume, backups by script.

## Considered Options

- **The localStorage-cart MVP** (order = lead with the cart in its comment, ~200 lines): built first and switched off with `SHOP_ENABLED = false`. It was the right call while the shop was a catalog plus an order request; it has no stock, order statuses or payment, which the owner now wants.
- **A separate repository for Medusa**: rejected — the shared contracts would have to be published or copied.
- **Fly.io / Railway / Render**: ≈€46–64/month for the same RAM against ≈€7.7; worth it only when HA, on-call without a developer or burst scaling matter. staywildwear's deploy/backup/alert scripts cut most of the VPS ops cost.
- **AWS Lightsail 4 GB**: plan B only.

## Consequences

- Caddy must be the only hop in front of Medusa: Medusa trusts one proxy (`trust proxy 1`), only Caddy publishes a port, and the in-process rate limits key on `req.ip`. A CDN or second proxy in front would make every client one IP. Limits are per process (fine with one instance) and key IPv6 clients by their /64.
- Images are built from the translated commit, pushed to GHCR tagged by full SHA only (`deploy.sh` refuses floating tags), via `pnpm deploy --filter @podbor/medusa --prod --legacy`. Migrations run in a one-off container from `.medusa/server` before the switch; rollback swaps the image, not the schema — a schema change is undone from backup.
- `deploy-medusa` lives in the same `ci.yml` with its own `deployed/medusa` tag; `deploy-brand-site` waits for it and is held only by its _failure_. A lockfile change redeploys every app including Medusa — accepted as simplest and correct.
