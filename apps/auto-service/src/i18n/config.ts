import { createLocaleSet, SOURCE_LOCALE } from '@podbor/i18n';

export const localeConfig = {
  locales: ['ru', 'sr', 'en'],
  primaryLocale: 'sr',
  ogLocale: {
    ru: 'ru_RU',
    sr: 'sr_RS',
    en: 'en_US',
  },
  ogSuffix: {
    ru: '-ru',
    sr: '',
    en: '-en',
  },
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
  ru: 'ru-RS',
  sr: 'sr-Latn-RS',
  en: 'en-RS',
};

export const LOCALE_NAME: Record<Locale, string> = {
  ru: 'Русский',
  sr: 'Srpski',
  en: 'English',
};
