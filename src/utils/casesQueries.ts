import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

const byDateDesc = (a: CollectionEntry<'cases' | 'autoserviceCases'>, b: CollectionEntry<'cases' | 'autoserviceCases'>) =>
  b.data.date.getTime() - a.data.date.getTime();

export const getPublishedCases = async () =>
  (await getCollection('cases', c => c.data.published)).sort(byDateDesc);

export const getPublishedAutoserviceCases = async () =>
  (await getCollection('autoserviceCases', c => c.data.published)).sort(byDateDesc);
