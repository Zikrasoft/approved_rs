import { localeSet, type Locale } from '@/i18n/config';
import { SITE_URL } from '@/utils/constants';

export interface PageHeadInput {
  title: string;
  description: string;
  ogImage?: string;
}

export const pageHead = (
  locale: Locale,
  pathname: string,
  { title, description, ogImage }: PageHeadInput,
) => ({
  title,
  description,
  ...localeSet.headLinks(SITE_URL, locale, pathname, ogImage),
});
