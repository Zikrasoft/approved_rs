import { seriesSlugOf } from '@podbor/catalog-contract/slug';
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
  partsCategory: (locale: Locale, slug: string, page: number | string = 1) =>
    `/${locale}/parts/c/${slug}/${Number(page) > 1 ? `${page}/` : ''}`,
  partNumber: (locale: Locale, slug: string) => `/${locale}/parts/p/${slug}/`,
  partsCart: (locale: Locale) => `/${locale}/parts/cart/`,
  partsMakes: (locale: Locale) => `/${locale}/parts/makes/`,
  partsMake: (locale: Locale, make: string) => `/${locale}/parts/${make}/`,
  partsSeries: (locale: Locale, make: string, series: string) =>
    `/${locale}/parts/${make}/${series}/`,
  partsSeriesCategory: (
    locale: Locale,
    make: string,
    series: string,
    category: string,
  ) => `/${locale}/parts/${make}/${series}/${category}/`,
  partsSearch: (locale: Locale) => `/${locale}/parts/search/`,
  partsModelSearch: (locale: Locale, make: string, model: string) =>
    `/${locale}/parts/search/?${new URLSearchParams({ make, model })}`,
  partsPrices: (locale: Locale) => `/${locale}/parts/prices/`,
  partsInquiry: (locale: Locale, part?: string) =>
    `/${locale}/parts/${part ? `?${new URLSearchParams({ part })}` : ''}#${PARTS_INQUIRY_ANCHOR}`,
  worksOfMake: (locale: Locale, make: string) =>
    `/${locale}/works/?${new URLSearchParams({ [WORKS_MAKE_PARAM]: make })}`,
  work: (locale: Locale, slug: string) => `/${locale}/works/${slug}/`,
  cars: (locale: Locale, page: number | string = 1) =>
    `/${locale}/cars/${Number(page) > 1 ? `${page}/` : ''}`,
  carsMake: (locale: Locale, make: string) => `/${locale}/cars/${make}/`,
  blog: (locale: Locale, page: number | string = 1) =>
    `/${locale}/blog/${Number(page) > 1 ? `${page}/` : ''}`,
  blogArticle: (locale: Locale, slug: string) => `/${locale}/blog/${slug}/`,
  contact: (locale: Locale) => `/${locale}/contact/`,
  thanks: (locale: Locale) => `/${locale}/thanks/`,
  partsThanks: (locale: Locale) => `/${locale}/thanks/parts/`,
  privacy: (locale: Locale) => `/${locale}/privacy/`,
  about: (locale: Locale) => `/${locale}/about/`,
};

export const PARTS_INQUIRY_ANCHOR = 'inquiry';

export const WORKS_MAKE_PARAM = 'make';

export type SeriesAddress = { name: string; make: { slug: string } };

export const seriesPath = (
  locale: Locale,
  { name, make }: SeriesAddress,
): string => PathBuilder.partsSeries(locale, make.slug, seriesSlugOf(name));

export type CataloguePages = {
  makes: Set<string>;
  series: Set<string>;
  categories: Set<string>;
};

export const placeKey = (...slugs: string[]): string => slugs.join('/');

export const seriesKey = ({ name, make }: SeriesAddress) =>
  placeKey(make.slug, seriesSlugOf(name));

export const catalogueLinks = (locale: Locale, pages: CataloguePages) => ({
  series: (series: SeriesAddress): string | null =>
    pages.series.has(seriesKey(series)) ? seriesPath(locale, series) : null,
  seriesCategory: (series: SeriesAddress, category: string): string | null =>
    pages.categories.has(placeKey(seriesKey(series), category))
      ? PathBuilder.partsSeriesCategory(
          locale,
          series.make.slug,
          seriesSlugOf(series.name),
          category,
        )
      : null,
});

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
