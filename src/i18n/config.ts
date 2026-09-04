export const DEFAULT_LOCALE: Locale = 'ru';
export const SUPPORTED_LOCALES = ['ru', 'en', 'sr', 'es', 'de'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Every locale a case's `translations` field can hold a value for (ru is
// the source language, not a translation target). Derived from
// SUPPORTED_LOCALES so a future locale addition surfaces here automatically
// instead of needing its own hand-spelled union in every consumer.
export type TranslatableLocale = Exclude<Locale, typeof DEFAULT_LOCALE>;
export const TRANSLATABLE_LOCALES = SUPPORTED_LOCALES.filter(
  (l): l is TranslatableLocale => l !== DEFAULT_LOCALE,
);

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Single place for the "default to ru" fallback used by every component that
// reads Astro.currentLocale — was previously duplicated as
// `(Astro.currentLocale ?? 'ru') as Locale` verbatim in 15+ files.
export function getLocale(currentLocale: string | undefined): Locale {
  return (currentLocale ?? DEFAULT_LOCALE) as Locale;
}
