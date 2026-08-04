import countriesData from '../data/countries.json';
import citiesData from '../data/cities.json';
import { FLAGS } from './constants';

interface CountryNames {
  name: string;
  nameGenitive: string;
  nameLocative: string;
  nameAccusative: string;
}
interface CountryNamesEn {
  name: string;
}
interface CityNames {
  name: string;
  nameLocative: string;
}
interface CityNamesEn {
  name: string;
}

export interface Country {
  code: string;
  ru: CountryNames;
  en: CountryNamesEn;
  sr: CountryNames;
  active: boolean;
}

export interface City {
  slug: string;
  ru: CityNames;
  en: CityNamesEn;
  sr: CityNames;
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

export const getCountryFlag = (code: string): string => FLAGS[code] ?? '🏳️';
