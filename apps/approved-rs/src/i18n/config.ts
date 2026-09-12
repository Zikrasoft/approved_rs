import { createLocaleSet } from '@podbor/i18n';

export const localeConfig = {
  locales: ['ru', 'en', 'sr', 'es', 'de'],
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
