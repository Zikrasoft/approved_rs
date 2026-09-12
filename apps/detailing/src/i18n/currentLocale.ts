import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

export function localeFrom(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return first && isLocale(first) ? first : DEFAULT_LOCALE;
}
