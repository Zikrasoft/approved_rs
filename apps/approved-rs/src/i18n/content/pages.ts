import type { Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { withPlaceholder } from '@/i18n/withPlaceholder';
import type { PagesContentData } from './pagesContentSchema';

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

export function pagesView(locale: Locale): PagesContent {
  return toPagesContent(content(locale).pages);
}
