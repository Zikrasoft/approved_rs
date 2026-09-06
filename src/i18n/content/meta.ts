import metaYaml from '../../content/i18n/meta.yaml?raw';
import type { Locale } from '@/i18n/config';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { withPlaceholder } from '@/i18n/withPlaceholder';
import { metaContentSchema, type MetaContentData } from './metaContentSchema';

interface MetaText {
  title: string;
  description: string;
}

export interface MetaTemplates {
  'vehicle-sourcing': (location: string) => MetaText;
  'vehicle-buyback': (location: string) => MetaText;
  'vehicle-inspection': (location: string) => MetaText;
}

function toTemplates(data: MetaContentData): MetaTemplates {
  const wrap =
    (text: MetaText) =>
    (location: string): MetaText => ({
      title: withPlaceholder(text.title, 'location', location),
      description: withPlaceholder(text.description, 'location', location),
    });
  return {
    'vehicle-sourcing': wrap(data['vehicle-sourcing']),
    'vehicle-buyback': wrap(data['vehicle-buyback']),
    'vehicle-inspection': wrap(data['vehicle-inspection']),
  };
}

// Admin hand-edits ru fields directly in meta.yaml; en/sr/es/de filled in
// by scripts/translate-i18n.ts (.github/workflows/translate.yml) — same
// pattern as src/i18n/getI18n.ts/src/i18n/content/faq.ts.
const getMeta = loadI18nSection(metaContentSchema, metaYaml);

export function getMetaTemplates(locale: Locale): MetaTemplates {
  return toTemplates(getMeta(locale));
}
