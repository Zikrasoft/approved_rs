import { swapLocalePath } from '@podbor/site-kit';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/config.ts';
import type { ServiceSlug } from './services';

export const PathBuilder = {
  home: (locale: Locale) => `/${locale}/`,
  services: (locale: Locale) => `/${locale}/services/`,
  service: (locale: Locale, slug: ServiceSlug) =>
    `/${locale}/services/${slug}/`,
  works: (locale: Locale) => `/${locale}/works/`,
  parts: (locale: Locale) => `/${locale}/parts/`,
  partsCategory: (locale: Locale, slug: string) =>
    `/${locale}/parts/c/${slug}/`,
  partNumber: (locale: Locale, slug: string) => `/${locale}/parts/p/${slug}/`,
  partsSearch: (locale: Locale) => `/${locale}/parts/search/`,
  partsVinUnresolved: (locale: Locale) => `/${locale}/parts/#vin-unresolved`,
  partsCar: (locale: Locale, vehicleId: string) =>
    `/${locale}/parts/car/${vehicleId}/`,
  shopPart: (locale: Locale, id: string) => `/${locale}/shop/${id}/`,
  shopCart: (locale: Locale) => `/${locale}/shop/cart/`,
  shopCheckout: (locale: Locale) => `/${locale}/shop/checkout/`,
  work: (locale: Locale, slug: string) => `/${locale}/works/${slug}/`,
  bmw: (locale: Locale) => `/${locale}/bmw/`,
  contact: (locale: Locale) => `/${locale}/contact/`,
  thanks: (locale: Locale) => `/${locale}/thanks/`,
  privacy: (locale: Locale) => `/${locale}/privacy/`,
  about: (locale: Locale) => `/${locale}/about/`,
};

export const PARTS_INQUIRY_ANCHOR = 'inquiry';

export function localePaths(): { params: { locale: Locale } }[] {
  return SUPPORTED_LOCALES.map((locale) => ({ params: { locale } }));
}

export const swapLocale = (pathname: string, locale: Locale): string =>
  swapLocalePath(pathname, locale);

export function withLocales<
  T extends { params: Record<string, string | undefined> },
>(
  paths: T[],
): (Omit<T, 'params'> & { params: T['params'] & { locale: Locale } })[] {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    paths.map((p) => ({ ...p, params: { locale, ...p.params } })),
  );
}
