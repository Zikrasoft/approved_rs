import type { CollectionEntry } from 'astro:content';
import { normalizePartNumber } from '@podbor/catalog-contract';
import { localizedEntry, publishedByNewest } from '@podbor/i18n';
import type { Locale } from '@/i18n/config';
import type { PartPageEntry } from './catalogueSnapshot';

type WorkEntry = CollectionEntry<'works'>;

export type Work = WorkEntry & {
  data: { image: NonNullable<WorkEntry['data']['image']> };
};

type WorkPart = Work['data']['parts'][number];

export const PARTS_SOURCING = 'vin-parts-inquiry';

export const localizedWork = (work: Work, locale: Locale) =>
  localizedEntry(work, locale);

export const publishedWorks = (works: WorkEntry[]): Work[] =>
  publishedByNewest(works).filter((work): work is Work =>
    Boolean(work.data.image),
  );

const sourcedBy = (page: PartPageEntry, { brand, number }: WorkPart) => {
  const wanted = brand.trim().toLowerCase();
  return (
    [page.brand.name.toLowerCase(), page.brand.slug].includes(wanted) &&
    normalizePartNumber(number) === page.normalized_value
  );
};

export const sourcedParts = (work: Work, pages: PartPageEntry[]) =>
  work.data.parts.map((part) => ({
    ...part,
    slug: pages.find((page) => sourcedBy(page, part))?.slug ?? null,
  }));

export const sourcingWorks = (
  works: WorkEntry[],
  page: PartPageEntry,
): Work[] =>
  publishedWorks(works).filter((work) =>
    work.data.parts.some((part) => sourcedBy(page, part)),
  );

export const workLeadService = ({ data: { servicesApplied } }: Work) =>
  servicesApplied.includes(PARTS_SOURCING)
    ? PARTS_SOURCING
    : servicesApplied[0];

export const workPrice = (work: Work): number | null =>
  work.data.servicesApplied.includes(PARTS_SOURCING)
    ? (work.data.priceRsd ?? null)
    : null;
