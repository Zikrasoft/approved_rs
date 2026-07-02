import { getActiveCountries, getCitiesForCountry, getActiveRoutes } from './geo';

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

export function getRoutePaths() {
  return getActiveRoutes().map(r => ({
    params: { route: `${r.from}-${r.to}` },
    props: { route: r },
  }));
}
