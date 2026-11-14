# Packages consumed by the shop

The package rules every change follows are in `AGENTS.md`; these two only bind
when a package reaches `apps/auto-service-shop`.

## CommonJS builds

**A package built for a CommonJS consumer ships a CommonJS build behind a
`require` condition.** `apps/auto-service-shop` is CommonJS and consumes
`packages/catalog-contract`, `packages/brands`, `@podbor/i18n`'s
`./translate/core` and `./section`, and `@podbor/lead-crm`'s
`./contact-channel`, `./limits`, `./fields`, `./parts-order-copy`, `./phone`,
`./vin`, `./verify-secret`, `./shop-orders-wire` and `./visitor-searches-wire`; they export
`{ "require": dist/cjs…, "default": src/….ts }`, build with
`tsc -p tsconfig.cjs.json` (`module: CommonJS`, `rewriteRelativeImportExtensions`)
and stamp `dist/cjs/package.json` with `{"type":"commonjs"}`. Their `test` task
depends on their own `build` in `turbo.json`, and a `cjs.test.ts` `require()`s
the result — so run such a package's tests through turbo
(`pnpm turbo run test --filter=<package>`); a bare `pnpm --filter <package> test`
finds no `dist/`.

## `catalog-contract` response schemas

**A `packages/catalog-contract` response schema tolerates a shop ahead of or
behind the storefront.** The shop deploys on its own VPS and can roll back,
so the storefront build parses responses from a newer or older shop. Response
schemas are `z.object` (unknown keys strip, never `z.strictObject`), a display
vocabulary (fuel, body style, identifier type, position) is `displayEnum`, so
a value newer than the contract reads as `null`, and **every field added from
now on is `.nullable().default(null)`** (or `.catch(null)`), so a shop that
has not shipped it yet still parses. A field becomes required only once every
deployed shop sends it. The contract tests pin this with an extra key, an
unknown enum value and a missing new field.
