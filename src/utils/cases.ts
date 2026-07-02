import type { CollectionEntry } from 'astro:content';

type Case = CollectionEntry<'cases'>;

interface CaseFilters {
  country?: string;
  service?: string;
}

export function getCasesForPage(cases: Case[], filters: CaseFilters): Case[] {
  return cases.filter(c => {
    if (!c.data.published) return false;
    if (filters.country && c.data.country !== filters.country) return false;
    if (filters.service && c.data.service !== filters.service) return false;
    return true;
  });
}
