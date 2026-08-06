import { getActiveCountries, getCitiesForCountry } from './geo';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

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
