import { getI18n } from '@/i18n/getI18n';
import { PathBuilder } from '@/utils/paths';
import type { Locale } from '@/i18n/config';
import {
  SERVICE_SLUGS_BY_BRAND,
  isBrandServiceSlug,
  type BrandServiceSlug,
} from '@podbor/brands';

export const SERVICE_SLUGS = SERVICE_SLUGS_BY_BRAND.approved;
export type ServiceSlug = BrandServiceSlug<'approved'>;

export const isServiceSlug = (value: string): value is ServiceSlug =>
  isBrandServiceSlug('approved', value);

export const COUNTRY_SCOPED_SERVICE_SLUGS = [
  'vehicle-sourcing',
  'vehicle-buyback',
  'vehicle-inspection',
] as const satisfies readonly ServiceSlug[];
export type CountryScopedServiceSlug =
  (typeof COUNTRY_SCOPED_SERVICE_SLUGS)[number];

export const SLUG = {
  SOURCING: 'vehicle-sourcing',
  IMPORT: 'vehicle-import',
  BUYBACK: 'vehicle-buyback',
  INSPECTION: 'vehicle-inspection',
} as const satisfies Record<string, ServiceSlug>;

export const SERVICES: { slug: CountryScopedServiceSlug }[] =
  COUNTRY_SCOPED_SERVICE_SLUGS.map((slug) => ({ slug }));

export function isCountryScopedServiceSlug(
  slug: string,
): slug is CountryScopedServiceSlug {
  return (COUNTRY_SCOPED_SERVICE_SLUGS as readonly string[]).includes(slug);
}

export const getNavItems = (
  locale: Locale,
): { href: string; label: string; slug: ServiceSlug }[] => {
  const nav = getI18n(locale).nav;
  return [
    {
      href: PathBuilder.vehicleSourcingHub(locale),
      label: nav[SLUG.SOURCING],
      slug: SLUG.SOURCING,
    },
    {
      href: PathBuilder.vehicleImportHub(locale),
      label: nav[SLUG.IMPORT],
      slug: SLUG.IMPORT,
    },
    ...SERVICES.filter((s) => s.slug !== SLUG.SOURCING).map((s) => ({
      href: PathBuilder.sectionRoot(locale, s.slug),
      label: nav[s.slug],
      slug: s.slug,
    })),
  ];
};
