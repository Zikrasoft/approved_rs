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

const MIN_EXCERPT = 110;

export function workExcerpt(body: string, max = 158): string {
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\]\([^)]*\)/g, '')
    .replace(/[#*_`>[\]]/g, '')
    .replace(/([^\s.!?:;])\s*\n\s*\n\s*/g, '$1. ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  const sentence = head.lastIndexOf('. ');
  if (sentence >= MIN_EXCERPT) return text.slice(0, sentence + 1);
  return `${head.slice(0, head.lastIndexOf(' ')).replace(/[\s,;:—-]+$/, '')}…`;
}
