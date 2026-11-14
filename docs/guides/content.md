# Content: collections, YAML copy and Keystatic

Unqualified paths are relative to `apps/approved-rs/`. How the copy gets
translated is in [translation.md](translation.md).

## Content model — two different systems by design

- **Case studies** (`src/content/cases` on approved.rs, `src/content/works` on the two brand sites, schemas in each app's `src/content.config.ts`) are Keystatic-managed Markdown collections. Admin writes `title`/`car`/`price`/etc. and the RU `title`/`body` only; a `translations: { en, sr, es, de }` field on the same entry (not a separate collection) holds the other four locales, each optional — missing/failed falls back to RU rather than breaking the page.
- **UI/site copy** (`src/content/i18n/*.yaml`: `dictionary`, `faq`, `home`, `pages`, `meta`, `leadForm`, `promoBanners`, `services`) is flat YAML, declared once per app in the `SECTIONS` registry (`src/i18n/sections.ts`: key, path, `*ContentSchema.ts` zod schema, translate prompt subject) and read only through `content(locale).<key>` (`src/i18n/content.ts`), which runs every section through the shared `loadI18nSection()` helper (`src/i18n/loadI18nSection.ts`, a thin binding over `@podbor/i18n`'s `createSectionLoader`) — it parses the YAML once at module load, validates RU against the schema (throws loudly on a bad file instead of failing at render time), and falls back to RU per-locale if a translation fails validation. `getI18n()` (`src/i18n/getI18n.ts`) additionally merges in `src/i18n/dictionaries/templates.ts` — the handful of interpolation functions (e.g. gallery alt-text templates) that can't be represented as static YAML strings.

## Keystatic

**Keystatic admin (`keystatic.config.ts`):** local dev reads/writes the working tree directly (`storage: { kind: 'local' }`); production (`import.meta.env.PROD`) goes through GitHub's API (`storage: { kind: 'github' }`) since Vercel's filesystem is ephemeral. Service slugs live once, in `SERVICE_SLUGS_BY_BRAND` in `packages/brands/src/serviceLabels.ts`, typed against `SERVICE_LABELS_RU` so a slug without a label is a compile error. `src/utils/labels.ts` (`src/utils/services.ts` on the brand sites), `src/content.config.ts` and the Keystatic select options all read that list — Keystatic's config cannot import Astro-coupled modules, but `@podbor/brands` is plain TypeScript. Add a service there and its label in the same edit; `serviceLabel()` still echoes an unknown slug rather than throwing, which only a slug outside the list (the `vehicle-import-<spoke>` sub-slugs, `parts-order`, the partner and legacy slugs) can reach.

- **Keystatic content paths need the app prefix in production.** GitHub's
  contents API resolves from the repo root, so a collection path is
  `` `${APP_ROOT}src/content/...` `` with
  `const APP_ROOT = import.meta.env.PROD ? 'apps/<app>/' : ''`. Local storage
  mode resolves from the app directory, hence the empty string in dev. The same
  applies to `src/lib/githubContents.ts` in approved-rs.
- Empty content directories need a `.gitkeep` — git does not track them, and
  both the glob loader and the registry test fail on a fresh clone without it.
