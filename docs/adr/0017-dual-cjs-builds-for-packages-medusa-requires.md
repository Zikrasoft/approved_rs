---
status: proposed
---

# Packages Medusa loads ship a CommonJS build beside their TypeScript sources

Implemented on branch `feat/carlab-shop`.

Medusa's backend is CommonJS and cannot load the `.ts` sources the Astro apps import. `shop-catalog`, `brands` and the `i18n` subpaths Medusa uses (`./translate/core`, `./section`) export `{ require: dist/cjs/…, default: src/….ts }`, built with `tsc -p tsconfig.cjs.json` and stamped with a `{"type":"commonjs"}` `package.json`. Astro, Vite and vitest keep reading sources, so the three sites build exactly as before.

## Consequences

- turbo runs `#test` after `build` for these packages; a `cjs.test.ts` that built inside `beforeAll` raced a concurrent `tsc` writing `dist/cjs`.
- The Docker image smoke-`require()`s every `@podbor/*` subpath Medusa uses, because packages have no `files` field and a missing `dist/cjs` would otherwise surface at runtime.
- A helper Medusa needs must live in one of these packages; `site-kit` has no CJS build, which is why the contact-link builders move to `brands`.
