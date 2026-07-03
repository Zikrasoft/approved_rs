import countriesData from '../data/countries.json';
import citiesData from '../data/cities.json';
import routesData from '../data/routes.json';

export interface Country {
  code: string;
  name: string;
  nameGenitive: string;
  nameLocative: string;
  nameAccusative: string;
  active: boolean;
}

export interface City {
  slug: string;
  name: string;
  nameLocative: string;
  country: string;
  active: boolean;
}

export interface Route {
  from: string;
  to: string;
  active: boolean;
}

const countries = countriesData as Country[];
const cities = citiesData as City[];
const routes = routesData as Route[];

export const getActiveCountries = (): Country[] =>
  countries.filter(c => c.active);

export const getCountry = (code: string): Country | undefined =>
  countries.find(c => c.code === code);

export const getCitiesForCountry = (countryCode: string): City[] =>
  cities.filter(c => c.country === countryCode && c.active);

export const getActiveRoutes = (): Route[] =>
  routes.filter(r => r.active);
