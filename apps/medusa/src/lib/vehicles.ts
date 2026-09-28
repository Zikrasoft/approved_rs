import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { type FitmentEntry, fitmentSchema } from '@podbor/shop-catalog';

import { VEHICLE_MODULE } from '../modules/vehicle/id';
import { queryAll } from './query';
import { type VehicleTree, fitmentComplaint } from './vehicle-tree';

export type Scope = Pick<MedusaContainer, 'resolve'>;

type GenerationRow = {
  id: string;
  name: string;
  year_from: number;
  year_to: number;
};

type ModelRow = {
  id: string;
  name: string;
  generations?: GenerationRow[] | null;
};

type MakeRow = { id: string; name: string; models?: ModelRow[] | null };

type VehicleReads = {
  listVehicleMakes(
    filters: object,
    config: { relations: string[] },
  ): Promise<MakeRow[]>;
};

type ProductRow = {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, 'sr');

export async function loadVehicleTree(scope: Scope): Promise<VehicleTree> {
  const rows = await scope
    .resolve<VehicleReads>(VEHICLE_MODULE)
    .listVehicleMakes({}, { relations: ['models', 'models.generations'] });
  return rows
    .map((make) => ({
      id: make.id,
      name: make.name,
      models: (make.models ?? [])
        .map((model) => ({
          id: model.id,
          name: model.name,
          generations: (model.generations ?? [])
            .map((generation) => ({
              id: generation.id,
              name: generation.name,
              yearFrom: generation.year_from,
              yearTo: generation.year_to,
            }))
            .sort((a, b) => a.yearFrom - b.yearFrom),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

export async function fitmentComplaintFor(
  scope: Scope,
  entries: readonly FitmentEntry[],
): Promise<string | undefined> {
  return entries.length
    ? fitmentComplaint(await loadVehicleTree(scope), entries)
    : undefined;
}

export function orphanedProducts(
  before: VehicleTree,
  after: VehicleTree,
  products: readonly ProductRow[],
): string[] {
  return products.flatMap((product) => {
    const fitment = fitmentSchema.safeParse(product.metadata?.fitment ?? []);
    const stranded =
      fitment.success &&
      fitment.data.some(
        (entry) =>
          !fitmentComplaint(before, [entry]) &&
          Boolean(fitmentComplaint(after, [entry])),
      );
    return stranded ? [product.title] : [];
  });
}

export async function productsOrphanedBy(
  scope: Scope,
  before: VehicleTree,
  after: VehicleTree,
): Promise<string[]> {
  const products = await queryAll<ProductRow>(
    scope.resolve(ContainerRegistrationKeys.QUERY),
    'product',
    ['id', 'title', 'metadata'],
  );
  return orphanedProducts(before, after, products);
}
