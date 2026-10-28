import { SUPPORTED_LOCALES } from '../i18n/config.ts';
import { vehiclePath, type VehicleAddress } from './paths.ts';

const PART_PAGE_SEGMENT = '/parts/p/';

export function sitemapFilter(
  site: string,
  partPages: { slug: string; indexable: boolean }[] = [],
  cars: { vehicle: VehicleAddress; solitary: boolean }[] = [],
): (page: string) => boolean {
  const excluded = ['/thanks/', '/parts/cart/'];
  const indexable = new Set(
    partPages.filter((page) => page.indexable).map(({ slug }) => slug),
  );
  const canonicalElsewhere = new Set(
    cars
      .filter((car) => car.solitary)
      .flatMap(({ vehicle }) =>
        SUPPORTED_LOCALES.map(
          (locale) => `${site}${vehiclePath(locale, vehicle)}`,
        ),
      ),
  );
  return (page) => {
    const [, partSlug] = page.split(PART_PAGE_SEGMENT);
    return (
      page !== `${site}/` &&
      !canonicalElsewhere.has(page) &&
      !excluded.some((part) => page.includes(part)) &&
      (partSlug === undefined || indexable.has(partSlug.replace(/\/$/, '')))
    );
  };
}
