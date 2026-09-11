import { getI18n } from '@/i18n/getI18n';
import { PathBuilder } from '@/utils/paths';
import type { Locale } from '@/i18n/config';

// Two source-of-truth slug lists everything else in this file (and
// content.config.ts, PathBuilder, generateMeta, Header.astro, faq.ts/
// services.ts) derives from — one shared typo surface instead of the same
// literals retyped per consumer.
//
// The 3 services with a [country] route (vehicle-import and
// auto-service-belgrade don't have one):
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
  'auto-service-belgrade',
  'detailing-belgrade',
] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

// Named handles for each slug, used below in getNavItems (nav[SLUG.SOURCING],
// PathBuilder.service(locale, SLUG.SOURCING, cc)) instead of the magic string
// 'vehicle-sourcing'. `satisfies` ties every value back to ServiceSlug
// without re-listing the slugs a second time.
export const SLUG = {
  SOURCING: 'vehicle-sourcing',
  IMPORT: 'vehicle-import',
  AUTO_SERVICE: 'auto-service-belgrade',
  DETAILING: 'detailing-belgrade',
  BUYBACK: 'vehicle-buyback',
  INSPECTION: 'vehicle-inspection',
} as const satisfies Record<string, ServiceSlug>;

// The 6 kinds shown on the /cases/ tab switcher — one per service, 'auto-service'/
// 'detailing' instead of 'auto-service-belgrade'/'detailing-belgrade' since each is
// a separate content collection (autoserviceCases/detailingCases), not a service
// enum value. Shared by CaseCategoryTabs' `active` prop, CasesTabPage's prop it's
// threaded through from, and getPromoBanners()'s `kind` param — one definition
// instead of the same literal union retyped in 3 files.
export type CasesTabKind =
  | 'vehicle-sourcing'
  | 'vehicle-buyback'
  | 'vehicle-inspection'
  | 'vehicle-import'
  | 'auto-service'
  | 'detailing';

// `slug` is both the URL path segment AND the internal identifier
// (dictionary/content keys, formService, SERVICE_LABELS) — fully unified
// after the site-wide English-slug migration, no more decoupling needed.
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

// Primary nav order: Автоподбор first, then the single-page Автосервис/
// Оклейка (Belgrade only, not per-country like the rest), then the
// remaining per-country SERVICES. Shared by Header (desktop + mobile) and Footer.
export const getNavItems = (
  locale: Locale,
  countryCode: string,
): { href: string; label: string; slug: string }[] => {
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
    {
      href: PathBuilder.autoServiceBelgrade(locale),
      label: nav[SLUG.AUTO_SERVICE],
      slug: SLUG.AUTO_SERVICE,
    },
    {
      href: PathBuilder.detailingBelgrade(locale),
      label: nav[SLUG.DETAILING],
      slug: SLUG.DETAILING,
    },
    ...SERVICES.filter((s) => s.slug !== SLUG.SOURCING).map((s) => ({
      href: PathBuilder.service(locale, s.slug, countryCode),
      label: nav[s.slug],
      slug: s.slug,
    })),
  ];
};

// Country-scoped items (vehicle-sourcing/vehicle-buyback/vehicle-inspection)
// put the service right after the locale (/ru/vehicle-sourcing/de/), with
// country next — including when vehicle-sourcing sits under a city segment
// too (/ru/vehicle-sourcing/de/berlin/), so checking segments[1]/[2]
// handles both without a separate city fallback.
export function isNavItemActive(
  item: { href: string; slug: string },
  locale: Locale,
  navCountry: string,
  pathname: string,
): boolean {
  const isCountryScoped = SERVICES.some((s) => s.slug === item.slug);
  if (!isCountryScoped) return pathname.startsWith(item.href);
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== locale || segments[1] !== item.slug) return false;
  // No country segment at all (the bare hub, e.g. /ru/vehicle-sourcing/)
  // still counts as active — only buyback/inspection lack a hub page, so
  // segments[2] is never actually undefined for those in practice.
  return segments[2] === navCountry || segments[2] === undefined;
}

// Keyed by form/Telegram service value — internal/ops-facing (Telegram bot
// messages), not part of the public site's i18n scope.
export const SERVICE_LABELS: Record<string, string> = {
  'vehicle-sourcing': 'Автоподбор',
  'vehicle-buyback': 'Выкуп',
  'vehicle-inspection': 'Проверка',
  'auto-service-belgrade': 'Автосервис',
  'detailing-belgrade': 'Детейлинг',
  'vehicle-import-de': 'Привоз из Германии',
  'vehicle-import-es': 'Привоз из Испании',
  'vehicle-import-ch': 'Привоз из Швейцарии',
  'vehicle-import-eu': 'Привоз из Европы',
  'vehicle-import-china': 'Привоз из Китая',
  'vehicle-import': 'Привоз авто',
};

export const AUTOSERVICE_SERVICES = [
  'diagnostics',
  'maintenance',
  'suspension',
  'engine',
  'prepurchase',
] as const;

// Detailing services a case can be tagged with — a case can carry several
// at once (e.g. wrap + ceramic on the same car), same array-tag shape as
// AUTOSERVICE_SERVICES above. Only 'wrap' is live today; the client plans
// to add more (anti-gravel film, ceramic coating, etc.) later — add new
// values here, they need nothing else structural to slot in.
export const DETAILING_SERVICES = ['wrap'] as const;
