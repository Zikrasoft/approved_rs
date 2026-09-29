# Russian is the only hand-written language; CI translates before anything deploys

Admins and developers write Russian only. The `translate` job runs each app's translate scripts on every push to any branch, commits the result back, and every downstream job checks out the SHA it left, so untranslated content cannot reach production. Keystatic cannot call an API from its form, so a "Translate" button there was never possible.

The unit of work is one string: `packages/i18n/src/translate/leafCache.ts` keys a committed cache (`apps/<app>/src/content/translations.cache.json`) on (system prompt, model, Russian string), so a run with nothing new makes no OpenAI request and the job stays unconditional rather than path-filtered. Changing the prompt or model changes the key and regenerates everything that prompt produced — the deliberate switch for a prompt fix.
