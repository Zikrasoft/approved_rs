import { localeSet, OG_SUFFIX, type Locale } from '@/i18n/config';
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
  ...localeSet.headLinks(SITE_URL, locale, pathname),
  ogImage: ogImage ?? new URL(`/og${OG_SUFFIX[locale]}.png`, SITE_URL).href,
});

export const canonicalUrl = (locale: Locale, pathname: string): string =>
  localeSet.headLinks(SITE_URL, locale, pathname).canonical;
