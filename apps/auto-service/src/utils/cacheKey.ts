import { createHash } from 'node:crypto';
import { partPageSlug } from '@podbor/catalog-contract';
import type { PartPageEntry } from './catalogueSnapshot';
import { seriesKey, type CataloguePages } from './paths';
import type { CollectionEntry } from 'astro:content';
import { sourcingWorks } from './works';

const plain = (_key: string, value: unknown) =>
  value instanceof Set
    ? [...value].sort()
    : value instanceof Map
      ? [...value]
      : value;

export const cacheKey = (rendered: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify([new Date().getFullYear(), rendered], plain))
    .digest('hex');

export function partCacheKey(
  props: {
    page: PartPageEntry;
    successor: unknown;
    replacements: { slug: string }[];
  },
  {
    bySlug,
    places,
    works,
  }: {
    bySlug: Map<string, PartPageEntry>;
    places: CataloguePages;
    works: CollectionEntry<'works'>[];
  },
): string {
  const { page } = props;
  const vehicles = [
    ...page.requirementCars,
    ...page.kitCars,
    ...page.fits.map(({ vehicle }) => vehicle),
  ];
  return cacheKey({
    ...props,
    equivalents: page.equivalents.map(
      ({ brand, normalized_value }) =>
        bySlug.get(partPageSlug(brand.slug, normalized_value)) ?? null,
    ),
    current: props.replacements.map(({ slug }) => bySlug.get(slug) ?? null),
    series: vehicles.map(({ model }) =>
      places.series.has(seriesKey(model.chassis.series)),
    ),
    works: sourcingWorks(works, page).map(({ id, body, data }) => ({
      id,
      body,
      data,
    })),
  });
}
