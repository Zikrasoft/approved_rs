import type { CollectionEntry } from 'astro:content';
import type { Locale } from '@/i18n/config';
import { localizedEntry, publishedEntries } from './localized';

export type Work = CollectionEntry<'works'>;

export function localizedWork(work: Work, locale: Locale) {
  const { car, ...rest } = localizedEntry(work, locale);
  return { ...rest, car: car ?? work.data.car };
}

export function publishedWorks(works: Work[]): Work[] {
  return publishedEntries(works).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}

// "Related" used to mean "the three newest", which pointed a brake job at two
// gearbox jobs and left six cases with a single inbound link. Works that share
// a service come first; the newest fill any remaining slot so a freshly added
// case is never left with an empty row.
export function relatedWorks(works: Work[], current: Work, limit = 3): Work[] {
  const services = new Set(current.data.servicesApplied);
  const others = works.filter((work) => work.id !== current.id);
  const shared = others.filter((work) =>
    work.data.servicesApplied.some((slug) => services.has(slug)),
  );
  const rest = others.filter((work) => !shared.includes(work));
  return [...shared, ...rest].slice(0, limit);
}
