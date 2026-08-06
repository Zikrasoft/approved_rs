# Project instructions

## i18n

This site supports 3 locales: `ru` (default), `en`, `sr`. Translations must always stay complete and in sync across all three.

- Any new user-facing string (page copy, component text, labels, aria-labels, alt text, meta title/description, error messages, etc.) must be added to all three locales at the same time — never RU-only "for now".
- Translations must sound natural in the target language, not literal word-for-word from Russian.
- Serbian needs correct grammatical case agreement (locative/genitive/accusative depending on preposition) — not just vocabulary swapped in.
- Store new strings in the existing i18n structure — `src/i18n/dictionaries/{ru,en,sr}.ts` for shared chrome, `src/i18n/content/*.ts` for page-body content — reusing existing keys where possible (DRY) rather than a new inline literal per component.
- Before considering any UI change done, verify no hardcoded RU-only text was left behind (e.g. `grep -rP '[а-яА-ЯёЁ]' src/components src/pages src/layouts` outside of comments/intentional RU-only surfaces).
