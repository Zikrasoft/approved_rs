import { getI18n } from '@/i18n/getI18n';
import { PathBuilder } from '@/utils/paths';
import type { Locale } from '@/i18n/config';

// Two source-of-truth slug lists everything else in this file (and
// content.config.ts, PathBuilder, generateMeta, Header.astro, faq.ts/
// services.ts) derives from — one shared typo surface instead of the same
// literals retyped per consumer.
//
// The 3 services with a [country] route (vehicle-import doesn't have one):
export const COUNTRY_SCOPED_SERVICE_SLUGS = [
  'vehicle-sourcing',
  'vehicle-buyback',
  'vehicle-inspection',
] as const;
export type CountryScopedServiceSlug =
  (typeof COUNTRY_SCOPED_SERVICE_SLUGS)[number];

// Every service slug, country-scoped or not:
export const SERVICE_SLUGS = [
  ...COUNTRY_SCOPED_SERVICE_SLUGS,
  'vehicle-import',
] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

// Named handles for each slug, used below in getNavItems (nav[SLUG.SOURCING],
// PathBuilder.service(locale, SLUG.SOURCING, cc)) instead of the magic string
// 'vehicle-sourcing'. `satisfies` ties every value back to ServiceSlug
// without re-listing the slugs a second time.
export const SLUG = {
  SOURCING: 'vehicle-sourcing',
  IMPORT: 'vehicle-import',
  BUYBACK: 'vehicle-buyback',
  INSPECTION: 'vehicle-inspection',
} as const satisfies Record<string, ServiceSlug>;

// The 4 kinds shown on the /cases/ tab switcher — one per service. Shared by
// CaseCategoryTabs' `active` prop and CasesTabPage's prop it's threaded
// through from — one definition instead of the same literal union retyped
// in several files.
export type CasesTabKind =
  | 'vehicle-sourcing'
  | 'vehicle-buyback'
  | 'vehicle-inspection'
  | 'vehicle-import';

export const SERVICES: { slug: CountryScopedServiceSlug }[] =
  COUNTRY_SCOPED_SERVICE_SLUGS.map((slug) => ({ slug }));

// Type guard instead of an unchecked `as CountryScopedServiceSlug` cast —
// narrows a page's broader `currentService: ServiceSlug` down to the 3 that
// actually have a [country] route, so a page passing e.g. 'vehicle-import'
// just skips the country cross-links instead of building a broken href.
export function isCountryScopedServiceSlug(
  slug: string,
): slug is CountryScopedServiceSlug {
  return (COUNTRY_SCOPED_SERVICE_SLUGS as readonly string[]).includes(slug);
}

// Primary nav order: Автоподбор first, then Привоз, then the remaining
// per-country SERVICES. Shared by Header (desktop + mobile) and Footer.
// Every entry points at the service's own hub: the country pages hang one
// click below it. Linking Выкуп/Проверка straight at /rs/ left their hubs
// with no inbound link on the whole site.
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
