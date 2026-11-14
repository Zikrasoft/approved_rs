import type { CollectionEntry } from 'astro:content';
import { BCP47_BY_LOCALE, type Locale } from '@/i18n/config';

export type Article = CollectionEntry<'articles'>;

export const BLOG_PAGE_SIZE = 12;

export const articleDate = (date: Date, locale: Locale) =>
  new Intl.DateTimeFormat(BCP47_BY_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
