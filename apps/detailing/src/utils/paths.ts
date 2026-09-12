import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import type { ServiceSlug } from './services';

export const PathBuilder = {
  home: (locale: Locale) => `/${locale}/`,
  services: (locale: Locale) => `/${locale}/usluge/`,
  service: (locale: Locale, slug: ServiceSlug) => `/${locale}/usluge/${slug}/`,
  works: (locale: Locale) => `/${locale}/radovi/`,
  work: (locale: Locale, slug: string) => `/${locale}/radovi/${slug}/`,
  contact: (locale: Locale) => `/${locale}/kontakt/`,
  thanks: (locale: Locale) => `/${locale}/hvala/`,
  privacy: (locale: Locale) => `/${locale}/privatnost/`,
};

export function swapLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  const rest = segments.slice(1).join('/');
  return rest ? `/${locale}/${rest}/` : `/${locale}/`;
}

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
