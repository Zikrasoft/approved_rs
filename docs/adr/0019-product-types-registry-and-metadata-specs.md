---
status: proposed
---

# Product types are one registry entry in code; specs live in product metadata

Implemented on branch `feat/carlab-shop`.

A developer adds a product type (batteries, motor oils, filters, brakes, …) as one entry in `PRODUCT_TYPES` in `@podbor/shop-catalog`. From it come the admin form, validation (`specSchema`/`parseAttributes`), card fields, facets and landing pages. Specs and fitment are language-neutral codes in `product.metadata` (Medusa does not translate metadata); labels live in the app's YAML. Admin middleware validates specs, a publish gate refuses an invalid typed product, and batch edits, CSV imports and edits of registry types are refused because they bypass the guards.

## Considered Options

- **Medusa options/attributes or a custom attributes module**: rejected — two definitions of a spec.

## Consequences

- Metadata is replaced whole on write, and several writers touch it (spec widget, translation stamp, catalog stamp), so every write is read-merge-write under a Redis lock; the admin widget writes only through `POST /admin/products/:id/spec`.
- A stale product whose spec no longer parses returns `{ok:false}` and never throws.
- Landing pages exist only for one value of a `landing` facet with at least `LANDING_MIN_PRODUCTS` (3) products, never per combination; a slug collision fails the build.
- Two slug helpers on purpose: Medusa handles use Cyrillic transliteration, landing slugs ASCII-fold spec values like `5W-30`.
