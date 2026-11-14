# What ends up in a bundle

Two ways a correct-looking import ships far more than it should.

## A helper on a lazily-loaded path

**A helper a lazily-loaded path depends on must live in a module that imports
nothing heavy.** Rollup cannot code-split a module that is also statically
imported, so putting such a helper beside a static `libphonenumber-js` import
inlines the whole library into the eager chunk — measured at 3 KB → 185 KB on
the lead form, a 60× regression aimed squarely at slow connections. Hence
`@podbor/lead-crm/compose-e164` and `/phone-input`, zero-import subpaths
separate from `/phone`. When extracting, check the emitted chunk, not the
source — `/phone-input` was measured at 4 KB eager with `libphonenumber-js`
still behind a dynamic import.

## Dev-only filesystem code in an SSR route

Dev-only filesystem code in an SSR route must sit inside an
`if (import.meta.env.DEV)` block with its `node:fs`/`node:path` imports done
dynamically inside it, never as the fall-through of an
`if (import.meta.env.PROD) { … return }` branch. Vite only folds away a
literal `if (false)`, so the fall-through form survives into the bundle, and
`@vercel/nft` then resolves its `process.cwd()` + dynamic path to "every file
under the workspace root" — which the Vercel adapter copies verbatim into the
deployed function (`.git`, `.env*` and every other app included; it was 353 MB
before this was fixed, 32 MB after). See
`apps/approved-rs/src/pages/api/admin/case-photos-*.ts` for the shape.
