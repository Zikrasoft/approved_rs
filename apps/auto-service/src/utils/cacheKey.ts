import { createHash } from 'node:crypto';
import { partPageSlug } from '@podbor/catalog-contract';
import type { PartPageEntry } from './catalogueSnapshot';
import {
  modelKey,
  vehicleKey,
  type CataloguePages,
  type VehicleAddress,
} from './paths';
import { sourcingWorks, type Work } from './works';

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

export const linkedVehicles = (
  places: CataloguePages,
  vehicles: VehicleAddress[],
): boolean[] =>
  vehicles.map((vehicle) => places.vehicles.has(vehicleKey(vehicle)));

export function partCacheKey(
  props: { page: PartPageEntry; successor: unknown; replacements: unknown },
  {
    bySlug,
    places,
    works,
  }: {
    bySlug: Map<string, PartPageEntry>;
    places: CataloguePages;
    works: Work[];
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
    vehicles: linkedVehicles(places, vehicles),
    models: vehicles.map(({ model }) => places.models.has(modelKey(model))),
    works: sourcingWorks(works, page).map(({ id, body, data }) => ({
      id,
      body,
      data,
    })),
  });
}
