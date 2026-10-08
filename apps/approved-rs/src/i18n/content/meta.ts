import type { Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { withPlaceholder } from '@/i18n/withPlaceholder';
import type { MetaContentData } from './metaContentSchema';

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

export function getMetaTemplates(locale: Locale): MetaTemplates {
  return toTemplates(content(locale).meta);
}
