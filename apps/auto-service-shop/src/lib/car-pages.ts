import type { ISearchModuleService } from '@medusajs/framework/types';
import { type CarHit, carHitSchema } from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';
import { z } from 'zod';

export const CATALOGUE_CAR_INDEX = 'catalogue_car';

export type SeriesAddress = { name: string; make: { slug: string } };

export type CarAddress = {
  id: string;
  model: { slug: string; chassis: { series: SeriesAddress } };
};

export const makeKey = (slug: string) => `make:${slug}`;
export const seriesKey = ({ name, make }: SeriesAddress) =>
  `series:${make.slug}/${seriesSlugOf(name)}`;
export const modelKey = (make: string, slug: string) => `model:${make}/${slug}`;
export const vehicleKey = (id: string) => `vehicle:${id}`;

export const fittedCarKeys = ({ id, model }: CarAddress): string[] => [
  makeKey(model.chassis.series.make.slug),
  seriesKey(model.chassis.series),
  modelKey(model.chassis.series.make.slug, model.slug),
  vehicleKey(id),
];

const hitSchema = z.object({
  id: z.string(),
  terms: z.array(z.string()),
  card: z.string(),
});

export const readCarHit = (document: unknown) => {
  const hit = hitSchema.safeParse(document);
  if (!hit.success) return [];
  try {
    const card = carHitSchema.safeParse(JSON.parse(hit.data.card));
    return card.success ? [{ ...hit.data, card: card.data }] : [];
  } catch {
    return [];
  }
};

export type PagedCars = Map<string, CarHit>;

export async function pagedCars(
  searchModule: ISearchModuleService,
  keys: string[],
): Promise<PagedCars> {
  const wanted = [...new Set(keys)];
  if (!wanted.length) return new Map();
  const { hits } = await searchModule
    .search({
      entity: CATALOGUE_CAR_INDEX,
      fields: ['id', 'terms', 'card'],
      filters: { id: wanted },
      pagination: { skip: 0, take: wanted.length },
    })
    .catch(() => ({ hits: [] }));
  return new Map(
    hits
      .flatMap(({ document }) => readCarHit(document))
      .map(({ id, card }) => [id, card]),
  );
}

const shared = (keys: string[], paged: PagedCars) => {
  const distinct = new Set(keys);
  return distinct.size === 1 ? paged.get([...distinct][0]) : undefined;
};

const seriesOf = (candidates: CarAddress[], series: SeriesAddress | null) =>
  candidates.length
    ? candidates.map(({ model }) => model.chassis.series)
    : series
      ? [series]
      : [];

export const nearestPlace = (
  candidates: CarAddress[],
  series: SeriesAddress | null,
  paged: PagedCars,
  makeSlug: string | null = null,
): CarHit | null =>
  shared(seriesOf(candidates, series).map(seriesKey), paged) ??
  shared(
    candidates.length
      ? candidates.map(({ model }) => makeKey(model.chassis.series.make.slug))
      : makeSlug
        ? [makeKey(makeSlug)]
        : [],
    paged,
  ) ??
  null;

export async function nearestPagedPlace(
  searchModule: ISearchModuleService,
  candidates: CarAddress[],
  series: SeriesAddress | null = null,
  makeSlug: string | null = null,
): Promise<CarHit | null> {
  const keys = [
    ...seriesOf(candidates, series).map(seriesKey),
    ...candidates.map(({ model }) => makeKey(model.chassis.series.make.slug)),
    ...(makeSlug ? [makeKey(makeSlug)] : []),
  ];
  return nearestPlace(
    candidates,
    series,
    await pagedCars(searchModule, keys),
    makeSlug,
  );
}
