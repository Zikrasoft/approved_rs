import type { CollectionEntry } from 'astro:content';
import { localizedEntry, publishedByNewest } from '@podbor/i18n';
import type { Locale } from '@/i18n/config';

export type Work = CollectionEntry<'works'>;

export const localizedWork = (work: Work, locale: Locale) =>
  localizedEntry(work, locale);

export const publishedWorks = (works: Work[]): Work[] =>
  publishedByNewest(works);

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
