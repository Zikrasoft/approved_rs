import { z } from 'zod';
import countriesData from '@/data/countries.json';
import citiesData from '@/data/cities.json';

const countryNamesSchema = z.object({
  name: z.string(),
  nameGenitive: z.string(),
  nameLocative: z.string(),
  nameAccusative: z.string(),
});
const cityNamesSchema = z.object({
  name: z.string(),
  nameLocative: z.string(),
});
const englishNameSchema = z.object({ name: z.string() });

const countrySchema = z.object({
  code: z.string(),
  ru: countryNamesSchema,
  en: englishNameSchema,
  sr: countryNamesSchema,
  es: englishNameSchema,
  de: englishNameSchema,
  active: z.boolean(),
});

const citySchema = z.object({
  slug: z.string(),
  ru: cityNamesSchema,
  en: englishNameSchema,
  sr: cityNamesSchema,
  es: englishNameSchema,
  de: englishNameSchema,
  country: z.string(),
  active: z.boolean(),
});

export type Country = z.infer<typeof countrySchema>;
export type City = z.infer<typeof citySchema>;

const countries = z.array(countrySchema).parse(countriesData);
const cities = z.array(citySchema).parse(citiesData);

export const getActiveCountries = (): Country[] =>
  countries.filter((c) => c.active);

const RUSSIAN_SPEAKING_DIAL_CODES = ['RU', 'UA', 'BY', 'KZ'];

export const phoneCountryShortlist = (): ReadonlySet<string> =>
  new Set([
    ...getActiveCountries().map((c) => c.code.toUpperCase()),
    ...RUSSIAN_SPEAKING_DIAL_CODES,
  ]);

export const getCountry = (code: string): Country | undefined =>
  countries.find((c) => c.code === code);

export const getCitiesForCountry = (countryCode: string): City[] =>
  cities.filter((c) => c.country === countryCode && c.active);
