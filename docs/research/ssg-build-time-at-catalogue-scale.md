# SSG build time at catalogue scale (spike for #380)

Question: does prerendering one page per brand-number, for about 20,000
brand-numbers in three locales, fit the nightly build, or do the part pages
need on-demand rendering (ISR)?

**Answer: it fits.** A full static build of 64,703 pages took 3 min 11 s on a
laptop and should take roughly 6 to 8 minutes on the CI runner. The real limit
is the size of the build output and of the upload, not the render time.

## Setup

- The `apps/auto-service` storefront on `carlab-shop` (Astro 7.2.10,
  `@astrojs/vercel` 11.0.9, `output: 'static'`).
- A throwaway prerendered copy of `src/pages/[locale]/shop/[id].astro`: the same
  `Shell`, `PageHero` and variant/offer table markup, and the same
  `<offer-cart-buy>` script. Its data came from an in-memory generator in
  `getStaticPaths`, so no fetch was timed.
- The test catalogue:
  - **Parts:** 6,667 Parts, each with 3 brand-numbers and 2 offers per
    brand-number, which makes 20,001 brand-numbers.
  - **Part pages:** one per brand-number per locale (ru, sr, en). Each lists the
    Part's equivalents as links, plus 8 model × category hub links.
  - **Hubs:** 2 Make, 60 Model, 24 Category and 1,440 Model × Category hubs, in
    each locale. Each hub page lists up to 60 Parts.
- Only `astro build` was timed (`vercel build` runs the same build). A runner
  generated the public env inline. The spike pages were deleted afterwards and
  were never committed.
- Machine: Apple Silicon, 10 cores, 32 GB, Node 24.21.

## Results

| Run                                   | HTML pages | Build wall time | Page render step | Static output | `.vercel/output` as tgz | Peak RSS |
| ------------------------------------- | ---------: | --------------: | ---------------: | ------------: | ----------------------: | -------: |
| Baseline (site today)                 |        122 |            10 s |            3.9 s |         30 MB |                   31 MB |   1.5 GB |
| 600 brand-numbers                     |      6,500 |            21 s |             12 s |        347 MB |                   77 MB |   1.4 GB |
| 6,667 brand-numbers (≈20k part pages) |     24,707 |            66 s |             47 s |        1.3 GB |                  217 MB |   1.6 GB |
| 20,001 brand-numbers (60k part pages) |     64,703 |           191 s |            141 s |        3.5 GB |                  525 MB |   1.4 GB |
| Same, `build.concurrency: 4`          |     64,703 |           176 s |            121 s |        3.5 GB |                  525 MB |   1.5 GB |

- **Time grows linearly** at about 2.2 ms per page for rendering. After the
  render step, about 45 to 50 s go to the sitemap and the Vercel adapter's file
  copy, and that also grows with page count.
- **Memory stays flat** at about 1.5 GB. Astro streams pages to disk.
- **`build.concurrency` barely helps** (8 %). Rendering is CPU-bound on one
  thread, so it is not worth turning on.
- **Page weight drives output size.** A part page is 53 KB of HTML (10 KB
  gzipped). Almost all of it is the `Shell`: header, footer, lead modal,
  Telegram choice and sticky bar. 64.7k pages × 53 KB = 3.5 GB.
- **The sitemap** listed 64,700 URLs. A real build must exclude un-enriched
  (noindex) pages from it, as the spec requires.

## On CI and Vercel

CI builds the site and Vercel only hosts it (ADR-0007). The nightly build runs
`vercel build` on `ubuntu-latest`, which has 4 vCPUs and 16 GB because the repo
is public, and then runs `vercel deploy --prebuilt --archive=tgz`. Vercel's
45-minute build-step limit therefore does not apply. The GitHub job limit is
6 hours.

- **Build time.** In run 39452392199 (2026-10-20), `vercel build` for
  auto-service took 20 s on CI against about 10 s locally. Taking that 2× as
  the factor, the 64.7k-page build would take about 6 to 7 minutes on CI. This
  is an estimate, not a measurement.
- **Upload.** The archive is about 525 MB. Today's 31 MB archive deploys in
  17 s. Vercel's documentation (`/docs/limits`, 2026-09) still lists a CLI
  upload limit of 100 MB on Hobby and 1 GB on Pro. A changelog dated
  2026-06-17 says "CLI-specific deployment limits" were removed, without
  naming them. The spike did not confirm which of the two applies, or which
  plan the CarLab project is on. **On Hobby with the 100 MB limit, the catalogue
  would not deploy at this size.**
- **Output file count.** Vercel sets no limit on output files. It only warns
  that builds slow down past about 100,000 files.

**Not measured:** a real deploy to Vercel. That would mean uploading 525 MB of
fake pages to the production project, or setting up a separate throwaway
project. To measure it on a throwaway Vercel project, restore the spike files
(below) and run:

```
vercel build --prod
vercel deploy --prebuilt --archive=tgz
```

## Recommendation

1. **Keep full SSG for part pages; ISR is not needed at this scale.** At about
   3 ms per page on CI, the nightly build stays under 15 minutes up to roughly
   200k pages.
2. **Watch upload size first.** About 8 KB of archive per page means the 1 GB
   Pro limit, if it still applies, is reached at about 120k pages, which is
   about 40k brand-numbers × 3 locales. Two things move that ceiling:
   - a lighter part-page shell, for example a lead modal loaded once instead of
     inlined on every page;
   - leaving un-enriched pages out of the prerender, but only if the spec
     allows that.

   Switch to ISR (the Vercel adapter's `isr` option) only after both are used
   up.

3. **Before the first real nightly publish**, confirm the CarLab Vercel
   project's plan and its current CLI upload limit.

## Reproducing

The harness was three throwaway files (a catalogue generator in
`src/spikeCatalogue.ts` driven by `SPIKE_BRAND_NUMBERS`, the part page in
`src/pages/[locale]/spike/[slug].astro` and the hub page in
`src/pages/[locale]/spike-hub/[...hub].astro`). They were deleted after the
runs and are not in the repo. To rebuild them, copy the markup of
`shop/[id].astro` into a prerendered page whose `getStaticPaths` returns
generated parts.
