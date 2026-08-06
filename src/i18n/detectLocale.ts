import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from './config';

export function detectLocale(acceptLanguage: string | null, cookieValue: string | undefined): Locale {
  if (cookieValue && isLocale(cookieValue)) return cookieValue;
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(',')
    .map(part => {
      const [tag, qPart] = part.trim().split(';q=');
      return { primary: tag.trim().toLowerCase().split('-')[0], q: qPart ? parseFloat(qPart) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { primary } of ranked) {
    const match = SUPPORTED_LOCALES.find(l => l === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
