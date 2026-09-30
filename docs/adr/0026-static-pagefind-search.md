---
status: accepted
---

# Shop search is a static Pagefind index, loaded on first focus

In `main` since PR #34. Owner decision 2026-09-29.

Free-text search (title, brand, spec codes, OEM numbers) runs in the browser against a per-locale Pagefind index built after `astro build`; there is no search server. Only product pages carry `data-pagefind-body`, and nothing loads until the search box gets focus.

## Consequences

- The index is written to both `dist/client/pagefind` and `.vercel/output/static/pagefind`, because the Vercel adapter copies `dist/client` before the index exists.
- It must not run when `SHOP_STATUS` is `off`, or Pagefind indexes every page.
- Search terms go in a hidden paragraph: `compressHTML` glues `<dt>Brand</dt><dd>Bosch</dd>` into `BrandBosch`.
- No Serbian stemmer; accepted. A search server (OpenSearch) becomes relevant with TecDoc-scale data.
