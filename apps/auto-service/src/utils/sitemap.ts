import type { CataloguePageList } from '@podbor/catalog-contract';
import { SUPPORTED_LOCALES } from '../i18n/config.ts';
import { CATEGORY_PAGE_SIZE } from './catalogueSnapshot';
import { PathBuilder } from './paths';

const PART_PAGE_SEGMENT = '/parts/p/';

export function sitemapFilter(
  site: string,
  partPages: { slug: string; indexable: boolean }[] = [],
  blogListed = true,
): (page: string) => boolean {
  const excluded = [
    '/thanks/',
    '/parts/cart/',
    '/admin/',
    ...(blogListed ? [] : ['/blog/']),
  ];
  const indexable = new Set(
    partPages.filter((page) => page.indexable).map(({ slug }) => slug),
  );
  return (page) => {
    const [, partSlug] = page.split(PART_PAGE_SEGMENT);
    return (
      page !== `${site}/` &&
      !excluded.some((part) => page.includes(part)) &&
      (partSlug === undefined || indexable.has(partSlug.replace(/\/$/, '')))
    );
  };
}

export function catalogueUrls(
  site: string,
  { parts, makes, series, categories }: CataloguePageList,
): string[] {
  const hubs = makes.filter(({ hub }) => hub);
  return SUPPORTED_LOCALES.flatMap((locale) =>
    [
      ...hubs.map(({ slug }) => PathBuilder.partsMake(locale, slug)),
      ...series.flatMap((entry) => [
        PathBuilder.partsSeries(locale, entry.make, entry.slug),
        ...entry.categories.map((category) =>
          PathBuilder.partsSeriesCategory(
            locale,
            entry.make,
            entry.slug,
            category,
          ),
        ),
      ]),
      ...categories.flatMap(({ slug, listed }) =>
        Array.from(
          {
            length: Math.max(1, Math.ceil((listed ?? 0) / CATEGORY_PAGE_SIZE)),
          },
          (_, index) => PathBuilder.partsCategory(locale, slug, index + 1),
        ),
      ),
      ...parts
        .filter(({ indexable }) => indexable)
        .map(({ slug }) => PathBuilder.partNumber(locale, slug)),
    ].map((path) => `${site}${path}`),
  );
}
