import { getActiveCountries, getCitiesForCountry } from './geo';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import type { CountryScopedServiceSlug } from './labels';
import type { VehicleImportSpoke } from './vehicleImportCrossSell';

// Single source of truth for every internal href the site links to — no
// page/component should build one with a raw template literal. Country-
// scoped services (the 3 with a [country] route) share one method; the
// rest (vehicle-import, auto-service-belgrade, cases, static pages) have
// their own fixed shape.
export const PathBuilder = {
  home: (locale: Locale) => `/${locale}/`,
  service: (locale: Locale, slug: CountryScopedServiceSlug, countryCode: string) =>
    `/${locale}/${slug}/${countryCode}/`,
  vehicleSourcingHub: (locale: Locale) => `/${locale}/vehicle-sourcing/`,
  vehicleSourcingCity: (locale: Locale, countryCode: string, citySlug: string) =>
    `/${locale}/vehicle-sourcing/${countryCode}/${citySlug}/`,
  vehicleImportHub: (locale: Locale) => `/${locale}/vehicle-import/`,
  // 'de'/'es'/'ch' nest under 'eu' (each reads as part of the Europe
  // grouping instead of a parallel top-level spoke) — still their own
  // dedicated page/URL for their own search intent, just one level deeper.
  vehicleImportSpoke: (locale: Locale, slug: VehicleImportSpoke) =>
    slug === 'de' || slug === 'es' || slug === 'ch'
      ? `/${locale}/vehicle-import/eu/${slug}/`
      : `/${locale}/vehicle-import/${slug}/`,
  autoServiceBelgrade: (locale: Locale) => `/${locale}/auto-service-belgrade/`,
  autoServiceCase: (locale: Locale, caseId: string) => `/${locale}/auto-service-belgrade/${caseId}/`,
  case: (locale: Locale, caseId: string) => `/${locale}/cases/${caseId}/`,
  casesVehicleSourcing: (locale: Locale) => `/${locale}/cases/vehicle-sourcing/`,
  casesAutoService: (locale: Locale) => `/${locale}/cases/auto-service/`,
  contacts: (locale: Locale) => `/${locale}/contacts/`,
  privacy: (locale: Locale) => `/${locale}/privacy/`,
  thanks: (locale: Locale) => `/${locale}/thanks/`,
};

export function getCountryPaths() {
  return getActiveCountries().map(c => ({ params: { country: c.code } }));
}

export function getCityPaths() {
  return getActiveCountries().flatMap(country =>
    getCitiesForCountry(country.code).map(city => ({
      params: { country: country.code, city: city.slug },
      props: { city },
    }))
  );
}

export function withLocales<T extends { params: Record<string, string | undefined> }>(
  paths: T[]
): (Omit<T, 'params'> & { params: T['params'] & { locale: Locale } })[] {
  return SUPPORTED_LOCALES.flatMap(locale =>
    paths.map(p => ({ ...p, params: { locale, ...p.params } }))
  );
}
