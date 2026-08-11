import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import { COUNTRY_SCOPED_SERVICE_SLUGS } from './labels';

const byDateDesc = (a: CollectionEntry<'cases' | 'autoserviceCases'>, b: CollectionEntry<'cases' | 'autoserviceCases'>) =>
  b.data.date.getTime() - a.data.date.getTime();

// Sourcing/buyback/inspection cases only — the /cases/vehicle-sourcing/ tab
// and its counts (here and in llmsTxt.ts). vehicle-import cases are a
// separate bucket shown on their own hub/spoke pages, not this tab; those
// pages query getCollection('cases') directly with their own service filter.
export const getPublishedCases = async () =>
  (await getCollection('cases', c => c.data.published && (COUNTRY_SCOPED_SERVICE_SLUGS as readonly string[]).includes(c.data.service)))
    .sort(byDateDesc);

export const getPublishedAutoserviceCases = async () =>
  (await getCollection('autoserviceCases', c => c.data.published)).sort(byDateDesc);
