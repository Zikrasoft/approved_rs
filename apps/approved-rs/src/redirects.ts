import { BRAND_SITES, brandLocale } from '@podbor/brands';
import type { Redirect } from '@podbor/site-kit/redirects';
import cities from './data/cities.json' with { type: 'json' };
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from './i18n/config.ts';

const LOCALE = `:locale(${SUPPORTED_LOCALES.join('|')})`;

function withAndWithoutSlash(source: string, destination: string): Redirect[] {
  return [
    { source, destination, permanent: true },
    { source: `${source}/`, destination, permanent: true },
  ];
}

function localized(from: string, to: string): Redirect[] {
  return [
    ...withAndWithoutSlash(`/${LOCALE}${from}`, `/:locale${to}`),
    ...withAndWithoutSlash(from, `/${PRIMARY_LOCALE}${to}`),
  ];
}

const LEGACY_PATHS: Record<string, string> = {
  ...Object.fromEntries(
    cities.map(({ country, slug }) => [
      `/${country}/${slug}/autopodbor`,
      `/vehicle-sourcing/${country}/${slug}`,
    ]),
  ),
  '/cases': '/cases/vehicle-sourcing',
  '/de/combined': '/vehicle-sourcing/de',
  '/rs/combined': '/vehicle-sourcing/rs',
  '/es/combined': '/vehicle-sourcing/es',
  '/rs/dostavka': '/vehicle-sourcing/rs',
  '/es/dostavka': '/vehicle-sourcing/es',
  '/de/autopodbor': '/vehicle-sourcing/de',
  '/rs/autopodbor': '/vehicle-sourcing/rs',
  '/es/autopodbor': '/vehicle-sourcing/es',
  '/cases/mercedes-c-2021-de': '/cases/vehicle-sourcing',
  '/cases/ford-focus-2020-rs': '/cases/vehicle-sourcing',
  '/cases/vw-golf-2022-rs': '/cases/vehicle-sourcing',
  '/cases/bmw-x5-2023-de': '/cases/vehicle-sourcing',
  '/cases/audi-a4-2022-de': '/cases/vehicle-sourcing',
};

const MOVED_BRAND_HUBS: Record<string, string> = {
  'auto-service-belgrade': BRAND_SITES.carlab,
  'avtoservis-belgrade': BRAND_SITES.carlab,
  'detailing-belgrade': BRAND_SITES.details,
  'wrapping-belgrade': BRAND_SITES.details,
};

const MOVED_BRAND_CASE_TABS: Record<string, string> = {
  'auto-service': BRAND_SITES.carlab,
  autoservice: BRAND_SITES.carlab,
  detailing: BRAND_SITES.details,
};

const SLUG_RENAMES: Record<string, string> = {
  autopodbor: 'vehicle-sourcing',
  privoz: 'vehicle-import',
  vykup: 'vehicle-buyback',
  proverka: 'vehicle-inspection',
};

const BUYBACK_COLLAPSED_COUNTRIES = ['de', 'es', 'ch', 'pt', 'fr', 'it', 'pl'];

const UNPREFIXED_SECTIONS = [
  'vehicle-sourcing',
  'vehicle-import',
  'vehicle-buyback',
  'vehicle-inspection',
  'cases',
  'contacts',
  'privacy',
  'thanks',
];

const brandTargets = [...new Set(SUPPORTED_LOCALES.map(brandLocale))];
const brandPrefixes = [
  ...brandTargets.map((target) => ({
    prefix: `/:locale(${SUPPORTED_LOCALES.filter((locale) => brandLocale(locale) === target).join('|')})`,
    target,
  })),
  { prefix: '', target: brandLocale(PRIMARY_LOCALE) },
];

const movedBrandRedirects = brandPrefixes.flatMap(({ prefix, target }) => [
  ...Object.entries(MOVED_BRAND_HUBS).flatMap(([slug, host]) => [
    ...withAndWithoutSlash(`${prefix}/${slug}`, `${host}/${target}/services/`),
    ...withAndWithoutSlash(
      `${prefix}/${slug}/:slug+`,
      `${host}/${target}/works/:slug+/`,
    ),
  ]),
  ...Object.entries(MOVED_BRAND_CASE_TABS).flatMap(([tab, host]) =>
    withAndWithoutSlash(`${prefix}/cases/${tab}`, `${host}/${target}/works/`),
  ),
]);

export const REDIRECTS: Redirect[] = [
  ...Object.entries(LEGACY_PATHS).flatMap(([from, to]) =>
    withAndWithoutSlash(from, `/${PRIMARY_LOCALE}${to}`),
  ),
  ...movedBrandRedirects,
  ...localized('/privoz/de/:path*', '/vehicle-import/eu/de/:path*'),
  ...localized('/vehicle-import/de/:path*', '/vehicle-import/eu/de/:path*'),
  ...Object.entries(SLUG_RENAMES).flatMap(([old, current]) => [
    ...localized(`/${old}/:path*`, `/${current}/:path*`),
    ...localized(`/cases/${old}`, `/cases/${current}`),
  ]),
  ...localized(
    `/vehicle-buyback/:country(${BUYBACK_COLLAPSED_COUNTRIES.join('|')})`,
    '/vehicle-buyback/',
  ),
];

export const EDGE_REDIRECTS: Redirect[] = [
  ...REDIRECTS,
  ...UNPREFIXED_SECTIONS.flatMap((section) =>
    withAndWithoutSlash(
      `/${section}/:path*`,
      `/${PRIMARY_LOCALE}/${section}/:path*`,
    ),
  ),
];
