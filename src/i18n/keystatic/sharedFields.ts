import { fields } from '@keystatic/core';

// No directory/publicPath override: Keystatic then stores each image next to
// its entry (e.g. src/content/cases/<slug>/photo.jpg, referenced as a
// relative path) — required by content.config.ts's `image()` schema, which
// needs a locally-resolvable path to optimize via astro:assets at build
// time, not a public/ URL string.
export const caseImage = () =>
  fields.image({ label: 'Фото', validation: { isRequired: true } });

// EN/SR/ES/DE translation, written by the bot (scripts/translate-cases.ts)
// — never by hand.
// Keystatic has no field type that can call an API from inside its own
// form (confirmed against 0.6.9, the latest release), so there was never a
// "Translate" button here to begin with. `fields.ignored()` keeps the whole
// nested en/sr/es/de object out of the form (nothing to accidentally
// hand-edit and fight the bot over) while round-tripping it untouched on
// save, same reasoning as translatedFrom below.
export const translationsField = () => fields.ignored();

// Written by the bot (see comment on translationsField above), not by
// hand — Keystatic's schema rejects unknown frontmatter/data keys, so this
// has to be declared even though the admin never touches it.
// `fields.ignored()` renders no input at all (not just disabled) and passes
// the stored value through untouched on save, so the bot's hash can't be
// edited or nuked by hand and doesn't clutter the form.
export const translatedFromField = () => fields.ignored();
