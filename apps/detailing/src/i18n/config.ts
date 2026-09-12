import { createLocaleSet } from '@podbor/i18n';

export const localeConfig = {
  locales: ['ru', 'sr', 'en'],
  defaultLocale: 'ru',
} as const;

export const localeSet = createLocaleSet(localeConfig);

export const {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  TRANSLATABLE_LOCALES,
  isLocale,
  getLocale,
  detectLocale,
} = localeSet;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslatableLocale = Exclude<Locale, typeof DEFAULT_LOCALE>;

export const BCP47_BY_LOCALE: Record<Locale, string> = {
  ru: 'ru-RS',
  sr: 'sr-Latn-RS',
  en: 'en-RS',
};

export const LOCALE_NAME: Record<Locale, string> = {
  ru: 'Русский',
  sr: 'Srpski',
  en: 'English',
};
