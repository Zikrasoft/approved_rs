import { swapLocalePath } from '@podbor/site-kit';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import type { ServiceSlug } from './services';

export const PathBuilder = {
  home: (locale: Locale) => `/${locale}/`,
  services: (locale: Locale) => `/${locale}/services/`,
  service: (locale: Locale, slug: ServiceSlug) =>
    `/${locale}/services/${slug}/`,
  works: (locale: Locale) => `/${locale}/works/`,
  work: (locale: Locale, slug: string) => `/${locale}/works/${slug}/`,
  contact: (locale: Locale) => `/${locale}/contact/`,
  thanks: (locale: Locale) => `/${locale}/thanks/`,
  privacy: (locale: Locale) => `/${locale}/privacy/`,
};

export const swapLocale = (pathname: string, locale: Locale): string =>
  swapLocalePath(pathname, locale);

export function localePaths(): { params: { locale: Locale } }[] {
  return SUPPORTED_LOCALES.map((locale) => ({ params: { locale } }));
}

export function withLocales<
  T extends { params: Record<string, string | undefined> },
>(
  paths: T[],
): (Omit<T, 'params'> & { params: T['params'] & { locale: Locale } })[] {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    paths.map((p) => ({ ...p, params: { locale, ...p.params } })),
  );
}
