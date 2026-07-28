import countriesData from '../data/countries.json';
import citiesData from '../data/cities.json';

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

const countries = countriesData as Country[];
const cities = citiesData as City[];

export const getActiveCountries = (): Country[] =>
  countries.filter(c => c.active);

export const getCountry = (code: string): Country | undefined =>
  countries.find(c => c.code === code);

export const getCitiesForCountry = (countryCode: string): City[] =>
  cities.filter(c => c.country === countryCode && c.active);

const COUNTRY_FLAGS: Record<string, string> = { de: '🇩🇪', rs: '🇷🇸', es: '🇪🇸', ch: '🇨🇭' };

export const getCountryFlag = (code: string): string => COUNTRY_FLAGS[code] ?? '🏳️';
