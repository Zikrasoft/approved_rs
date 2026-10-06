import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import type { ServiceSlug } from './labels';

const byDateDesc = (a: CollectionEntry<'cases'>, b: CollectionEntry<'cases'>) =>
  b.data.date.getTime() - a.data.date.getTime();

export const getPublishedCasesByService = async (
  service: CollectionEntry<'cases'>['data']['service'],
) =>
  (
    await getCollection(
      'cases',
      (c) => c.data.published && c.data.service === service,
    )
  ).sort(byDateDesc);

export const getCasesTabCounts = async (): Promise<
  Record<ServiceSlug, number>
> => {
  const cases = await getCollection('cases', (c) => c.data.published);
  const counts: Record<ServiceSlug, number> = {
    'vehicle-sourcing': 0,
    'vehicle-buyback': 0,
    'vehicle-inspection': 0,
    'vehicle-import': 0,
  };
  for (const c of cases) counts[c.data.service]++;
  return counts;
};
