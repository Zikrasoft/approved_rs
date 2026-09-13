import { SOURCE_LOCALE, type Locale } from '@/i18n/config';

export interface LocalizableEntry {
  body?: string;
  data: {
    title: string;
    car?: string;
    translations?: Partial<
      Record<string, { title: string; body: string; car?: string }>
    >;
  };
}

export interface LocalizedEntry {
  title: string;
  body: string;
  car?: string;
}

export function localizedEntry(
  entry: LocalizableEntry,
  locale: Locale,
): LocalizedEntry {
  const source = {
    title: entry.data.title,
    body: entry.body ?? '',
    car: entry.data.car,
  };
  if (locale === SOURCE_LOCALE) return source;

  const translated = entry.data.translations?.[locale];
  const car = translated?.car?.trim() ? translated.car : source.car;
  if (!translated?.title?.trim() || !translated.body.trim())
    return { ...source, car };
  return { title: translated.title, body: translated.body, car };
}

export function publishedEntries<T extends { data: { published: boolean } }>(
  entries: T[],
): T[] {
  return entries.filter((entry) => entry.data.published);
}
