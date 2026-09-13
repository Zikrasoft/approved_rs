import type { CollectionEntry } from 'astro:content';
import { SOURCE_LOCALE, type Locale } from '@/i18n/config';

export type Work = CollectionEntry<'works'>;

export function localizedWork(
  work: Work,
  locale: Locale,
): { title: string; body: string; car: string } {
  const fallback = {
    title: work.data.title,
    body: work.body ?? '',
    car: work.data.car,
  };
  if (locale === SOURCE_LOCALE) return fallback;

  const translated = work.data.translations?.[locale];
  if (!translated?.title?.trim() || !translated.body.trim()) return fallback;
  return {
    title: translated.title,
    body: translated.body,
    car: translated.car?.trim() ? translated.car : fallback.car,
  };
}

export function publishedWorks(works: Work[]): Work[] {
  return works
    .filter((w) => w.data.published)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
