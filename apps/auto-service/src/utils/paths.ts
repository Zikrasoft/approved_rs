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
  partsModel: (locale: Locale, make: string, model: string) =>
    `/${locale}/parts/${make}/${model}/`,
  partsModelCategory: (
    locale: Locale,
    make: string,
    model: string,
    category: string,
  ) => `/${locale}/parts/${make}/${model}/${category}/`,
  partsVehicle: (
    locale: Locale,
    make: string,
    model: string,
    vehicle: string,
  ) => `/${locale}/parts/${make}/${model}/m/${vehicle}/`,
  partsSearch: (locale: Locale) => `/${locale}/parts/search/`,
  partsPrices: (locale: Locale) => `/${locale}/parts/prices/`,
  partsInquiry: (locale: Locale, part?: string) =>
    `/${locale}/parts/${part ? `?${new URLSearchParams({ part })}` : ''}#${PARTS_INQUIRY_ANCHOR}`,
  partsCar: (locale: Locale, vehicleId: string) =>
    `/${locale}/parts/car/${vehicleId}/`,
  work: (locale: Locale, slug: string) => `/${locale}/works/${slug}/`,
  bmw: (locale: Locale) => `/${locale}/bmw/`,
  contact: (locale: Locale) => `/${locale}/contact/`,
  thanks: (locale: Locale) => `/${locale}/thanks/`,
  partsThanks: (locale: Locale) => `/${locale}/thanks/parts/`,
  privacy: (locale: Locale) => `/${locale}/privacy/`,
  about: (locale: Locale) => `/${locale}/about/`,
};

export const PARTS_INQUIRY_ANCHOR = 'inquiry';

export type VehicleAddress = {
  id: string;
  slug: string | null;
  model: { slug: string; chassis: { series: { make: { slug: string } } } };
};

export const vehiclePath = (
  locale: Locale,
  { id, slug, model }: VehicleAddress,
): string =>
  PathBuilder.partsVehicle(
    locale,
    model.chassis.series.make.slug,
    model.slug,
    slug ?? id,
  );

export type CataloguePages = {
  makes: Set<string>;
  models: Set<string>;
  categories: Set<string>;
  vehicles: Set<string>;
};

export const placeKey = (...slugs: string[]): string => slugs.join('/');

export const modelKey = ({ slug, chassis }: VehicleAddress['model']) =>
  placeKey(chassis.series.make.slug, slug);

export const vehicleKey = (vehicle: VehicleAddress) =>
  placeKey(modelKey(vehicle.model), vehicle.slug ?? vehicle.id);

export const catalogueLinks = (locale: Locale, pages: CataloguePages) => ({
  model: (model: VehicleAddress['model']): string | null =>
    pages.models.has(modelKey(model))
      ? PathBuilder.partsModel(
          locale,
          model.chassis.series.make.slug,
          model.slug,
        )
      : null,
  vehicle: (vehicle: VehicleAddress): string | null =>
    pages.vehicles.has(vehicleKey(vehicle))
      ? vehiclePath(locale, vehicle)
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
