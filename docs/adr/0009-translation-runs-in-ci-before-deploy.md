# Russian is the only hand-written language; CI translates before anything deploys

Admins and developers write Russian only. The `translate` job runs each app's translate scripts on every push to any branch, commits the result back, and every downstream job checks out the SHA it left, so untranslated content cannot reach production. Keystatic cannot call an API from its form, so a "Translate" button there was never possible.

The unit of work is one string: `packages/i18n/src/translate/leafCache.ts` keys a committed cache (`apps/<app>/src/content/translations.cache.json`) on (system prompt, model, Russian string), so a run with nothing new makes no OpenAI request and the job stays unconditional rather than path-filtered. Changing the prompt or model changes the key and regenerates everything that prompt produced — the deliberate switch for a prompt fix.

## Consequences

- `SOURCE_LOCALE = 'ru'` is hard-wired in `packages/i18n`; which locale a site _presents_ by default is the separate per-app `primaryLocale`. Swapping them silently renders Serbian pages in Russian.
- The cache must stay committed; deleting it re-buys the corpus (~112k characters per locale). Renaming a case directory drops its cache block and the next run adopts its translations as hand-written.
- A hand-edited translation is adopted only while `translatedFrom` (a hash of the file's whole Russian source) still matches, so editing any Russian string in a file discards every hand-written translation in that file. Fix translations and Russian in separate commits.
- Model output is untrusted: `assertSafeTranslation` rejects introduced HTML and dropped `{placeholders}`, and case bodies render through `sanitize-html`.
- Translate scripts are never run locally except to debug them: a local run stamps a fresh hash and CI then has nothing to do.
- The single `translate` job still couples the brands: one unfixable file in one app fails the job and blocks every deploy. A per-app matrix would decouple them at the cost of three parallel commits to one branch; not done yet.
