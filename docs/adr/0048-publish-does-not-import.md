---
status: accepted
---

# Publish does not import; an Import is its own background run

Decided 2026-10-28 with the owner, after the pre-release review of the parts shop. Replaces the import step of the Publish chain in [ADR-0043](0043-supplier-adapters-catalogue-import-page-per-brand-number.md).

**Decision:** Publish only translates, rebuilds and deploys carlab.rs and refreshes search. A Supplier's catalogue is read into the shop by an Import that staff start from that Supplier's button. The Import runs in the background, not inside the request, records a report of what it made and skipped, isolates each article so one bad page does not stop the rest, and is safe to run again from the start. One lock covers every writer of the catalogue (Import, Publish, bulk deletion), and a run counts as abandoned when it stops reporting that it is alive, not when it gets old. Every Import asks the AI one structured question per new article (name, Category, attributes and description together, on a smaller model) and caches answers by prompt, model and input, so a repeated article is never paid for twice.

**Why:** with the crawled catalogues (tens of thousands of pages) an Import takes hours and costs real money, while Publish has to stay a quick, frequent action. Inside Publish the whole crawl would be re-read on every press, a long run would be mistaken for an abandoned one after its age limit, and two writers could race on the same rows.

## Considered Options

- **Keep the import in Publish, importing only pages crawled since the last run.** Rejected: Publish still waits on the slowest Supplier, and the lock and failure isolation are needed anyway.
- **OpenAI's Batch API for the first large Import.** Deferred: half the price, but the Import would become two-phase with answers arriving up to a day later.
