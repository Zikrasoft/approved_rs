# llms.txt lists what stays bounded

Each site's `llms.txt` follows the llms.txt format (one H1 with the brand name, a blockquote summary, H2-grouped links, a note after a link written as `: note`) and aims at the 2026 convention of 20 to 50 curated links under about 3000 tokens. carlab.rs's parts catalogue is the one part of any site that grows with data rather than with editing: every Make, Model and Vehicle with enough Parts gets a page, and the supplier catalogue can add hundreds. So carlab.rs lists the catalogue only down to the page of every Make: the parts index, the search (with how to query it), each Category and the makes index. Make, Model and Vehicle pages are reached from that index and from the sitemap, never listed one by one.

The budget is a target, not a test, and two sites sit outside it on purpose. approved.rs lists 52 links: the country by service grid and the city pages are what it offers, and cutting real pages to reach 50 would hide them from agents for a round number. details.rs lists about 14: it has fewer pages than that worth naming, and padding the file with filler defeats the point of a curated list.

## Consequences

Works are listed in full on both brand sites, which fits today (carlab.rs about 43 links). When a site's works push it well past 50 links, they fold into the works index link with a count, as approved.rs already does for its cases. `/.well-known/ai-catalog.json` on all three sites points agents at each locale's `llms.txt`, built by `renderAiCatalog` beside `renderBrandLlmsTxt` in `packages/i18n`.
