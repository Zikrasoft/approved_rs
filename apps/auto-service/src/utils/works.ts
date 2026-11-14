import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { makeArticles } from '@podbor/blog/article';
import { makePages } from '@podbor/blog/make-pages';
import { normalizePartNumber } from '@podbor/catalog-contract';
import {
  localizedEntry,
  publishedByNewest,
  publishedEntries,
} from '@podbor/i18n';
import type { Locale } from '@/i18n/config';
import type { Article } from './blog';
import type { MakePartsEntry, PartPageEntry } from './catalogueSnapshot';
import { MAKES } from './makes';
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

export const makeGroup = ({ data: { make } }: Work): string | undefined => make;

const carried = (works: Work[], count: number) =>
  MAKES.filter(
    ({ slug }) =>
      works.filter((work) => makeGroup(work) === slug).length >= count,
  );

export const sharedMakes = (works: Work[]) =>
  carried(works, 2).map(({ slug, name }) => ({ label: name, group: slug }));

export const makesOf = (works: Work[]) => carried(works, 1);

export const workshopMakePages = (
  works: WorkEntry[],
  articles: Article[],
  parts: MakePartsEntry[],
) =>
  makePages(MAKES, {
    works: featuredWorks(works),
    articles: publishedEntries(articles),
    parts: parts.map((entry) => ({
      ...entry,
      data: { make: entry.make.slug },
    })),
  }).map((page) => ({ ...page, ...makeArticles(page.articles) }));

export type WorkshopMakePage = ReturnType<typeof workshopMakePages>[number];

export const overviewConflicts = (pages: WorkshopMakePage[]) =>
  pages.flatMap(({ make, overview, ignoredOverviews }) =>
    overview && ignoredOverviews.length > 0
      ? [
          `Make ${make.slug} has ${ignoredOverviews.length + 1} overview Articles (${[overview, ...ignoredOverviews].map(({ id }) => id).join(', ')}); using ${overview.id}`,
        ]
      : [],
  );

export const makeCover = ({ overview, works }: WorkshopMakePage) =>
  overview?.data.image ?? publishedByNewest(works)[0]?.data.image;

export const CARS_PAGE_SIZE = 24;

const WORKSHOP = 'workshop';

const SERVICE_PHOTO: Partial<Record<ServiceSlug, string>> = {
  diagnostics: 'bmw-x3',
  servicing: 'mercedes-benz-c200',
  'brakes-suspension': 'obsluzhivanie-tormoznoj-sistemy',
  'engine-gearbox': WORKSHOP,
  'bodywork-painting': WORKSHOP,
  'pre-purchase-inspection': WORKSHOP,
};

export interface Photo {
  image: ImageMetadata;
  alt: string;
}

export const servicePhoto = (
  slug: ServiceSlug,
  works: WorkEntry[],
  workshop: Photo,
): Photo | undefined => {
  const source = SERVICE_PHOTO[slug];
  if (source === WORKSHOP) return workshop;
  const image = publishedWorks(works).find((work) => work.id === source)?.data
    .image;
  return image && { image, alt: '' };
};
