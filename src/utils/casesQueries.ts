import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import type { CasesTabKind } from './labels';

const byDateDesc = (a: CollectionEntry<'cases' | 'autoserviceCases'>, b: CollectionEntry<'cases' | 'autoserviceCases'>) =>
  b.data.date.getTime() - a.data.date.getTime();

export const getPublishedCasesByService = async (service: CollectionEntry<'cases'>['data']['service']) =>
  (await getCollection('cases', c => c.data.published && c.data.service === service)).sort(byDateDesc);

export const getPublishedAutoserviceCases = async () =>
  (await getCollection('autoserviceCases', c => c.data.published)).sort(byDateDesc);

// One counts map for every /cases/ tab's badge number — a single pass over
// each collection instead of a separate getCollection call per tab.
export const getCasesTabCounts = async (): Promise<Record<CasesTabKind, number>> => {
  const [cases, autoserviceCases] = await Promise.all([
    getCollection('cases', c => c.data.published),
    getCollection('autoserviceCases', c => c.data.published),
  ]);
  const counts: Record<CasesTabKind, number> = {
    'vehicle-sourcing': 0,
    'vehicle-buyback': 0,
    'vehicle-inspection': 0,
    'vehicle-import': 0,
    'auto-service': autoserviceCases.length,
  };
  for (const c of cases) counts[c.data.service]++;
  return counts;
};
