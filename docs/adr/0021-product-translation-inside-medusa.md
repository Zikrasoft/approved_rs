---
status: proposed
---

# Products are auto-translated inside Medusa, stamped per locale

Implemented on branch `feat/carlab-shop`.

The admin writes Russian. On `product.created`/`updated` a subscriber sends each target locale (sr-RS, en-US) to OpenAI as its own call through `@podbor/i18n/translate/core` (so one failure keeps the other), writes results only through Medusa's translation workflows (only those emit `translation.*` events), and stamps a hash of the Russian source per locale (`translated_from_sr`, `translated_from_en`). An unchanged hash makes no OpenAI call and also breaks the update-event loop; an hourly backlog job retries up to 50 products.

## Consequences

- Medusa 2.19's native translation module needs **both** the module entry (tables) and `featureFlags.translation` (routes and Store API localisation); either alone looks enabled and is not. `sr-RS` is not among the 51 seeded locales and is created by the seed.
- Variant titles and service products are not translated; the storefront never renders `variant.title` in sr/en and names services from its own YAML.
- A hand-fixed translation is overwritten when the Russian source changes.
- The order email copy is not in Medusa's module: it is RU YAML in `apps/medusa` translated by the repo's CI loop like every app.
