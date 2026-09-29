# Shared packages hold mechanics, never visual identity

`packages/*` carry behaviour that two or more apps need — lead capture (`lead-crm`), i18n and auto-translate (`i18n`), brand constants (`brands`), and browser/server mechanics (`site-kit`: safeMarkdown, formatPhone, visitor id, scroll lock, modal, lazy map, funnel tracking). Components, design tokens and styles stay per app, because a shared token turns every brand's look into an edit of one file that three brands own.

## Considered Options

- **`packages/ui-kit`** with shared visual primitives: planned, then rejected during the split — it is exactly what would make the sites recognisable as siblings and couples three independent designs.
- **A root base `tsconfig`**: rejected — `astro/tsconfigs/strict` already gives the strict set, `paths` resolve relative to their own file, and three apps found nothing else in common beyond one `extends` line.
