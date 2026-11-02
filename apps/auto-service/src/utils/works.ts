import type { CollectionEntry } from 'astro:content';
import { normalizePartNumber } from '@podbor/catalog-contract';
import { localizedEntry, publishedByNewest } from '@podbor/i18n';
import type { Locale } from '@/i18n/config';
import type { PartPageEntry } from './catalogueSnapshot';
import type { ServiceSlug } from './services';

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

export const featuredWorks = (works: WorkEntry[]): Work[] => {
  const published = publishedWorks(works);
  return [
    ...published.filter((work) => work.data.featured),
    ...published.filter((work) => !work.data.featured),
  ];
};

export const titleNamesCar = (title: string, car: string) =>
  title.toLowerCase().startsWith(car.toLowerCase());

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

const MAKES = [
  'Alfa Romeo',
  'Audi',
  'BMW',
  'Honda',
  'Mercedes-Benz',
  'MINI',
  'Peugeot',
  'Seat',
  'Skoda',
  'VW',
];

export const makeOf = ({ data: { car } }: Work): string | undefined =>
  MAKES.find((make) => car.toLowerCase().startsWith(make.toLowerCase()));

const groupOf = (make: string) => make.toLowerCase().replaceAll(' ', '-');

export const makeGroup = (work: Work): string | undefined => {
  const make = makeOf(work);
  return make && groupOf(make);
};

export const sharedMakes = (works: Work[]) =>
  MAKES.filter(
    (make) => works.filter((work) => makeOf(work) === make).length > 1,
  ).map((make) => ({ label: make, group: groupOf(make) }));

export const makesOf = (works: Work[]): string[] =>
  MAKES.filter((make) => works.some((work) => makeOf(work) === make));

const SERVICE_PHOTO_WORK: Partial<Record<ServiceSlug, string>> = {
  diagnostics: 'bmw-x3',
  servicing: 'mercedes-benz-c200',
  'brakes-suspension': 'obsluzhivanie-tormoznoj-sistemy',
  'engine-gearbox': 'velikij-servis-zamena-grm',
};

export const servicePhoto = (slug: ServiceSlug, works: WorkEntry[]) =>
  publishedWorks(works).find((work) => work.id === SERVICE_PHOTO_WORK[slug])
    ?.data.image;
