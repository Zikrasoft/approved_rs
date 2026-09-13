import { createLocaleSet, SOURCE_LOCALE } from '@podbor/i18n';

export const localeConfig = {
  locales: ['ru', 'en', 'sr', 'es', 'de'],
  primaryLocale: 'ru',
} as const;

export const localeSet = createLocaleSet(localeConfig);

export const {
  SUPPORTED_LOCALES,
  PRIMARY_LOCALE,
  TRANSLATABLE_LOCALES,
  isLocale,
  getLocale,
  detectLocale,
} = localeSet;

export { SOURCE_LOCALE };

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslatableLocale = Exclude<Locale, typeof SOURCE_LOCALE>;

export const BCP47_BY_LOCALE: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  sr: 'sr-RS',
  es: 'es-ES',
  de: 'de-DE',
};
