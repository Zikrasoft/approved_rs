import pagesYaml from '../../content/i18n/pages.yaml?raw';
import type { Locale } from '@/i18n/config';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { withPlaceholder } from '@/i18n/withPlaceholder';
import {
  pagesContentSchema,
  type PagesContentData,
} from './pagesContentSchema';

// The one shape difference from PagesContentData: privacy.metaDescription
// is a real translated string containing the literal token "{siteName}"
// (see pagesContentSchema.ts) — this wraps it back into the
// `(siteName) => string` function the one call site
// (src/pages/[locale]/privacy.astro) expects, so that file doesn't change.
export interface PagesContent extends Omit<PagesContentData, 'privacy'> {
  privacy: Omit<PagesContentData['privacy'], 'metaDescription'> & {
    metaDescription: (siteName: string) => string;
  };
}

function toPagesContent(data: PagesContentData): PagesContent {
  return {
    ...data,
    privacy: {
      ...data.privacy,
      metaDescription: (siteName: string) =>
        withPlaceholder(data.privacy.metaDescription, 'siteName', siteName),
    },
  };
}

const getPages = loadI18nSection(pagesContentSchema, pagesYaml);

export function getPagesContent(locale: Locale): PagesContent {
  return toPagesContent(getPages(locale));
}
