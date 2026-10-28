import type { ISearchModuleService } from '@medusajs/framework/types';
import { type CarHit, carHitSchema } from '@podbor/catalog-contract';
import { z } from 'zod';

export const CATALOGUE_CAR_INDEX = 'catalogue_car';

export type CarAddress = {
  id: string;
  model: { slug: string; chassis: { series: { make: { slug: string } } } };
};

export const makeKey = (slug: string) => `make:${slug}`;
export const modelKey = (slug: string) => `model:${slug}`;
export const vehicleKey = (id: string) => `vehicle:${id}`;

export const fittedCarKeys = ({ id, model }: CarAddress): string[] => [
  makeKey(model.chassis.series.make.slug),
  modelKey(model.slug),
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

export const nearestPlace = (
  candidates: CarAddress[],
  modelSlug: string | null,
  paged: PagedCars,
): CarHit | null =>
  (candidates.length === 1
    ? paged.get(vehicleKey(candidates[0].id))
    : undefined) ??
  shared(
    candidates.length
      ? candidates.map(({ model }) => modelKey(model.slug))
      : modelSlug
        ? [modelKey(modelSlug)]
        : [],
    paged,
  ) ??
  shared(
    candidates.map(({ model }) => makeKey(model.chassis.series.make.slug)),
    paged,
  ) ??
  null;

export async function nearestPagedPlace(
  searchModule: ISearchModuleService,
  candidates: CarAddress[],
  modelSlug: string | null = null,
): Promise<CarHit | null> {
  const keys = [
    ...candidates.flatMap(fittedCarKeys),
    ...(modelSlug ? [modelKey(modelSlug)] : []),
  ];
  return nearestPlace(
    candidates,
    modelSlug,
    await pagedCars(searchModule, keys),
  );
}
