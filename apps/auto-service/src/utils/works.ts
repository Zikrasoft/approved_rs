import type { ImageMetadata } from 'astro';
import { paginate } from '@podbor/site-kit/pagination';
import type { CollectionEntry } from 'astro:content';
import { makeArticles } from '@podbor/blog/article';
import { makePages } from '@podbor/blog/make-pages';
import {
  normalizePartNumber,
  partPageSlug,
  slugOf,
  type CatalogueMake,
} from '@podbor/catalog-contract';
import {
  localizedEntry,
  publishedByNewest,
  publishedEntries,
} from '@podbor/i18n';
import type { Locale } from '@/i18n/config';
import type { Article } from './blog';
import type { CarMakeParts } from './catalogue';
import type { PartCard } from './partEntry';
import { MAKES, type Make } from './makes';
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

const sourcedBy = (page: PartCard, { brand, number }: WorkPart) => {
  const wanted = brand.trim().toLowerCase();
  return (
    [page.brand.name.toLowerCase(), page.brand.slug].includes(wanted) &&
    normalizePartNumber(number) === page.normalized_value
  );
};

const pageSlugOf = ({ brand, number }: WorkPart): string | null => {
  const normalized = normalizePartNumber(number);
  return normalized && partPageSlug(slugOf(brand), normalized);
};

export const sourcedParts = (work: Work, slugs: Set<string>) =>
  work.data.parts.map((part) => {
    const slug = pageSlugOf(part);
    return { ...part, slug: slug && slugs.has(slug) ? slug : null };
  });

export const sourcingWorks = (works: WorkEntry[], page: PartCard): Work[] =>
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

export const workshopMakePages = <P extends { make: { slug: string } }>(
  works: WorkEntry[],
  articles: Article[],
  parts: P[],
  makes: CatalogueMake[] = MAKES,
) =>
  makePages(makes, {
    works: featuredWorks(works),
    articles: publishedEntries(articles),
    shown: makes
      .filter(({ show_on_site }) => show_on_site)
      .map(({ slug }) => ({ data: { make: slug } })),
  }).map((page) => ({
    ...page,
    parts: parts.filter(({ make }) => make.slug === page.make.slug),
    ...makeArticles(page.articles),
  }));

export type MakeParts = CarMakeParts & { make: Make };

export type WorkshopMakePage = ReturnType<
  typeof workshopMakePages<MakeParts>
>[number];

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

export const CARS_PAGE_NUMBER = /^[2-9]\d*$/;

export type MakeTile = { make: Make; cover: ImageMetadata | undefined };

export const makeTiles = (works: WorkEntry[], articles: Article[]) =>
  workshopMakePages<MakeParts>(works, articles, []).map((page): MakeTile => ({
    make: page.make,
    cover: makeCover(page),
  }));

export const carsListing = (tiles: MakeTile[], page?: string) => {
  const listings = paginate(tiles, CARS_PAGE_SIZE);
  if (page === undefined) return listings[0];
  return CARS_PAGE_NUMBER.test(page)
    ? (listings[Number(page) - 1] ?? null)
    : null;
};

type Written = { works: WorkEntry[]; articles: Article[] };

export const carsListingPage = (
  segment: string,
  { works, articles }: Written,
) => {
  const cards = makeTiles(works, articles);
  const listing = carsListing(cards, segment);
  return listing && { listing, cards };
};

export const carMakePage = async (
  segment: string,
  { works, articles }: Written,
  partsOf: (make: string) => Promise<CarMakeParts | null>,
): Promise<WorkshopMakePage | null> => {
  const page = workshopMakePages<MakeParts>(works, articles, []).find(
    ({ make }) => make.slug === segment,
  );
  if (!page) return null;
  const parts = await partsOf(page.make.slug);
  return { ...page, parts: parts ? [{ make: page.make, ...parts }] : [] };
};

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
