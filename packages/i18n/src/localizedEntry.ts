import { SOURCE_LOCALE } from './locales.ts';

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

export interface LocalizedEntry<
  Car extends string | undefined = string | undefined,
> {
  title: string;
  body: string;
  car: Car;
}

export function localizedEntry<E extends LocalizableEntry>(
  entry: E,
  locale: string,
): LocalizedEntry<E['data']['car']> {
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

export function publishedByNewest<
  T extends { data: { published: boolean; date: Date } },
>(entries: T[]): T[] {
  return publishedEntries(entries).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}
