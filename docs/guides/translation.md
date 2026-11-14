# Translation: the translate job, the cache and hand edits

Unqualified paths are relative to `apps/approved-rs/`. The content it
translates is described in [content.md](content.md); the deploy side is in
[deploy.md § Content auto-translation](deploy.md#content-auto-translation).

## The auto-translate mechanism

**Both content systems share one auto-translate mechanism:** admin/dev only ever hand-writes RU. The `translate` job in `.github/workflows/ci.yml` runs each app's `scripts/translate-i18n.ts` plus `scripts/translate-cases.ts` on approved.rs and `scripts/translate-works.ts` on the two brand sites, on every push to `main` (a branch is checked by a manual `workflow_dispatch` run, which translates it too) and commits the result back. Jobs run on `vars.RUNNER` when it is set (`self-hosted`: the Mac runners, each isolated by `COMPOSE_PROJECT_NAME` and `SHOP_TEST_*` ports in its own `.env`), else on GitHub. The `translate` job itself stays unconditional rather than path-filtered — every string is looked up in the leaf cache first, so a run with nothing new makes no OpenAI request at all, and every job downstream reads the SHA it left behind, so untranslated content cannot reach production. **Deploy filtering is a separate step** (`scope` in `verify`, against per-app `refs/tags/deployed/<app>` tags) — why: `docs/adr/0008-deploy-only-what-is-stale-in-production.md`. **The unit of work is one string, not one file.** `packages/i18n/src/translate/leafCache.ts` keys a committed cache on the triple (system prompt, model, Russian string), so a rerun asks the model only for the strings whose Russian actually moved — the rest come back from `apps/<app>/src/content/translations.cache.json`. It must stay committed: deleting it regenerates the whole corpus at OpenAI's price. The cache is keyed by file path, so renaming a case directory drops its block and the next run adopts the committed translations as if they were hand-written, which quietly exempts that file from the next prompt fix. Editing the prompt or the model changes the fingerprint and regenerates everything that prompt produced, which is the deliberate switch for a prompt fix. The prompt names the target language, so the fingerprint is per locale, and `localeGuidance` on either translator (approved.rs's `LOCALE_GUIDANCE` in `translateConfig.ts`, the Serbian search phrase) is how one locale's wording is steered and regenerated without touching the other three. `translatedFrom` still records the hash of the whole RU source, and is what tells the job whether the committed translations correspond to the Russian in the file right now — the condition a hand-written translation is adopted under. Both scripts call through `packages/i18n/src/translate/openaiChat.ts` (official `openai` SDK) and validate the AI's response with `packages/i18n/src/translate/assertSafeTranslation.ts`, which rejects a translation that introduces HTML the RU source didn't already have (a stored-XSS guard on an otherwise-unreviewed auto-commit path — case bodies are rendered as markdown via `src/lib/safeMarked.ts`, which itself sanitizes with `sanitize-html`). Needs `OPENAI_API_KEY` as a GitHub Actions secret (separate from Vercel's env vars); without it the job fails at the translate step but doesn't touch already-translated content.

## Hand-written translations

**A hand-written translation survives on its own, in its own commit.** The
translate job compares each string in the file against what the cache says it
produced; a value that differs was written by a person, so it is adopted and
served from then on — but only while `translatedFrom` says the file's
translations were made from the Russian it holds now. That condition is what
separates a person's edit from stale machine output left behind by a
reordered list or a chunk that failed last run. The catch is the word _alone_, and it is wider than it
looks: `translatedFrom` hashes the file's **whole** Russian source, so editing
any Russian string in a file discards every hand-written translation in that
file, not only the one whose source moved. Fix translations in one commit and
Russian in another. The job logs `overwriting hand-written <path>` for each
dropped translation whose own Russian is unchanged — the one whose Russian you
just edited is replaced without a line in the log, because there is no cache
entry under its new key to compare against. An unsafe hand-edit — a dropped `{placeholder}`, any Cyrillic
letter, a blank — is refused with a warning; the cached translation
is served instead, or the string is retranslated if there is none. Adopting
it would fail the whole-file guard on every subsequent run and wedge the
pipeline. **Never hand-compute a matching `translatedFrom` yourself to quiet
a failing test.** A correct-looking hash with no real translate run behind
it tells `apps/*/src/i18n/content/content.test.ts` every section is now fully
translated, which un-skips its deep fallback checks (`it.skipIf(!translated)`)
across the _whole app_ — including sections you didn't touch — and they will
fail honestly on any section still RU-only. Leave the hash stale until a real
CI translate run produces the backing translations; a stale hash keeps those
checks correctly skipped.

## Running the scripts

The translate scripts resolve content paths relative to the process's working
directory, so they must run from inside the app:

```bash
cd apps/approved-rs
node --experimental-strip-types scripts/translate-i18n.ts   # i18n YAML (needs OPENAI_API_KEY)
node --experimental-strip-types scripts/translate-cases.ts  # case studies
```

Neither has a dry-run mode: both call OpenAI, rewrite the YAML or the
frontmatter, move `translatedFrom` and write `translations.cache.json`.
Translation belongs to CI — run these locally only to debug the scripts
themselves, and expect a diff to commit or discard afterwards.
