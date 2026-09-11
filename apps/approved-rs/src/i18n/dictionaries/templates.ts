import type { Locale } from '@/i18n/config';

// The 3 dictionary leaves that are real interpolation logic, not static
// text — YAML holds data, not functions, so these can't live in
// src/content/i18n/dictionary.yaml like the rest of common.gallery. Small
// and rarely changed enough that hand-maintaining 5 locales here beats
// building placeholder-syntax machinery for 3 strings. getI18n() merges
// this back into common.gallery so call sites are unaffected.
export interface GalleryTemplates {
  altTemplate: (name: string, i: number) => string;
  openAriaTemplate: (i: number, total: number) => string;
  showMoreTemplate: (n: number) => string;
}

const templates: Record<Locale, GalleryTemplates> = {
  ru: {
    altTemplate: (name, i) => `${name}, фото ${i + 1}`,
    openAriaTemplate: (i, total) => `Открыть фото ${i + 1} из ${total}`,
    showMoreTemplate: (n) => `Показать ещё (${n})`,
  },
  en: {
    altTemplate: (name, i) => `${name}, photo ${i + 1}`,
    openAriaTemplate: (i, total) => `Open photo ${i + 1} of ${total}`,
    showMoreTemplate: (n) => `Show more (${n})`,
  },
  sr: {
    altTemplate: (name, i) => `${name}, fotografija ${i + 1}`,
    openAriaTemplate: (i, total) => `Otvori fotografiju ${i + 1} od ${total}`,
    showMoreTemplate: (n) => `Prikaži još (${n})`,
  },
  es: {
    altTemplate: (name, i) => `${name}, foto ${i + 1}`,
    openAriaTemplate: (i, total) => `Abrir foto ${i + 1} de ${total}`,
    showMoreTemplate: (n) => `Ver más (${n})`,
  },
  de: {
    altTemplate: (name, i) => `${name}, Foto ${i + 1}`,
    openAriaTemplate: (i, total) => `Foto ${i + 1} von ${total} öffnen`,
    showMoreTemplate: (n) => `Mehr anzeigen (${n})`,
  },
};

export function getGalleryTemplates(locale: Locale): GalleryTemplates {
  return templates[locale];
}
