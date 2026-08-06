export const SUPPORTED_LOCALES = ['ru', 'en', 'sr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Single place for the "default to ru" fallback used by every component that
// reads Astro.currentLocale — was previously duplicated as
// `(Astro.currentLocale ?? 'ru') as Locale` verbatim in 15+ files.
export function getLocale(currentLocale: string | undefined): Locale {
  return (currentLocale ?? DEFAULT_LOCALE) as Locale;
}
