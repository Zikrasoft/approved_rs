---
status: accepted
---

# Pause the Medusa shop deploy, repurpose the "Запчасти"/Shop nav slot

Decided 2026-10-15.

carlab.rs already had a working Medusa-backed parts shop (catalog, cart, checkout → Lead, `apps/medusa` on a Hetzner VPS) behind the `nav.shop` nav item and `SHOP_STATUS` feature flag (default `off` in production). The owner wants to validate demand for a much simpler flow first — a visitor sends a VIN/chassis number and a contact, and staff pick the parts by hand — before committing to rebuilding the real shop, which will look nothing like the current one.

**The existing "Запчасти" nav slot is repurposed.** It now points at `/parts/`, a lead-capture page (`apps/auto-service/src/pages/[locale]/parts.astro`), instead of the Medusa catalog at `/shop/`. The `nav.shop` i18n key was renamed to `nav.parts` to match — the label text itself ("Запчасти"/"Delovi"/"Parts") did not need to change, only what it points to.

**The old shop/cart/checkout code is not deleted**, only unlinked: nothing in the nav or on the homepage points at `/shop/` any more, but the pages, `apps/medusa`, and `infra/medusa` stay in the repo untouched. `apps/medusa`'s CI deploy job (`deploy-medusa` in `.github/workflows/ci.yml`) is paused with a `false &&` short-circuit on its `if:`, marked with a `TODO:` pointing back at this ADR. The job's `medusa-image`/`medusa-integration` build-and-test steps keep running on every push — they cost nothing extra and keep the parked backend from bit-rotting — only the actual deploy-to-VPS step stops.

**Why pausing `deploy-medusa` is safe for the other two sites:** `deploy`/`deploy-brand-site` (approved.rs, details.rs, carlab.rs itself) only gate on `needs.deploy-medusa.result != 'failure'`. A job whose `if:` evaluates to `false` reports `skipped`, which already satisfies that check — the same way `deploy-medusa` already no-ops today whenever `verify` sees no change under `apps/medusa`. The `false &&` doesn't change that contract, it just forces the skip unconditionally.

**VIN/chassis number is not a new field on `StoredLead`.** `packages/lead-crm` already removed one brand-specific field this way: a `car` field existed for CarLab and was folded into the free-text `comment` (see the `TODO:` at `packages/lead-crm/src/form.ts`) rather than carried as its own column in a package shared by three brands. VIN follows the same shape: the form posts a `vin` field, and `leadSubmissionSchema`'s transform joins it as the first line of `comment` (`VIN: <value>\n...`), which is exactly what the owner's Telegram card already prints as `Комментарий: ...`. No schema change in `packages/lead-crm`, no new surface for approved.rs or details.rs.

**The VIN field is required, against the site's "only the contact is required" rule.** Every other form on the three sites asks for nothing but a contact, by design — a lead is answerable without a name or a service. This one page is the deliberate exception: without a VIN or chassis number, staff have nothing to look parts up against, so the field carries HTML5 `required` (loosely — no format or length check, so an unusual chassis number still gets through).

**What reopens this decision:** once the real shop is designed and built, the `/parts/` lead page, the paused `deploy-medusa` job, and the `vin-parts-inquiry` service slug all need revisiting together — the new shop will not be a resumed version of the old cart, so this is a deliberate stop, not a bookmark to resume from unchanged.
