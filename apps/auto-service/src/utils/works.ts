import type { CollectionEntry } from 'astro:content';
import { localizedEntry, publishedByNewest } from '@podbor/i18n';
import type { Locale } from '@/i18n/config';

export type Work = CollectionEntry<'works'>;

export const localizedWork = (work: Work, locale: Locale) =>
  localizedEntry(work, locale);

export const publishedWorks = (works: Work[]): Work[] =>
  publishedByNewest(works);
