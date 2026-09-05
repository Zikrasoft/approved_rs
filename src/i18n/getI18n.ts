import dictionaryYaml from '../content/i18n/dictionary.yaml?raw';
import type { Locale } from './config';
import { loadI18nSection } from './loadI18nSection';
import {
  dictionaryContentSchema,
  type DictionaryContent,
} from './dictionaryContentSchema';
import {
  getGalleryTemplates,
  type GalleryTemplates,
} from './dictionaries/templates';

export type Dictionary = DictionaryContent & {
  common: DictionaryContent['common'] & {
    gallery: DictionaryContent['common']['gallery'] & GalleryTemplates;
  };
};

// Admin hand-edits ru fields directly in dictionary.yaml; en/sr/es/de
// filled in by scripts/translate-i18n.ts (.github/workflows/translate.yml).
// Not astro:content: a single flat data file doesn't need collection/
// listing machinery, and `?raw` inlines it into the build like any other
// module (unlike a runtime fs.readFileSync, which Vercel's serverless bundler
// doesn't trace through a dynamic `new URL(..., import.meta.url)` path —
// confirmed by a real `pnpm build`, which fails with ENOENT for that
// approach). Staying synchronous (no astro:content) also matters because
// 20+ call sites across .astro components call getI18n() without awaiting,
// and getI18n.test.ts exercises it under plain vitest with no astro:content
// runtime available.
const getDictionary = loadI18nSection(dictionaryContentSchema, dictionaryYaml);

export function getI18n(locale: Locale): Dictionary {
  const content = getDictionary(locale);

  return {
    ...content,
    common: {
      ...content.common,
      gallery: {
        ...content.common.gallery,
        ...getGalleryTemplates(locale),
      },
    },
  };
}
