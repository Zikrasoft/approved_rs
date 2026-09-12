import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';

export interface LocalizableEntry {
  body?: string;
  data: {
    title: string;
    translations?: Partial<Record<string, { title: string; body: string }>>;
  };
}

export function localizedEntry(
  entry: LocalizableEntry,
  locale: Locale,
): { title: string; body: string } {
  const fallback = { title: entry.data.title, body: entry.body ?? '' };
  if (locale === DEFAULT_LOCALE) return fallback;

  const translated = entry.data.translations?.[locale];
  if (!translated?.title?.trim() || !translated.body.trim()) return fallback;
  return { title: translated.title, body: translated.body };
}

export function publishedEntries<T extends { data: { published: boolean } }>(
  entries: T[],
): T[] {
  return entries.filter((entry) => entry.data.published);
}
