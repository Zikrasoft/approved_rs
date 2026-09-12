import type { CollectionEntry } from 'astro:content';
import type { Locale } from '@/i18n/config';
import { localizedEntry, publishedEntries } from './localized';

export type Work = CollectionEntry<'works'>;

export function localizedWork(work: Work, locale: Locale) {
  return localizedEntry(work, locale);
}

export function publishedWorks(works: Work[]): Work[] {
  return publishedEntries(works).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}
