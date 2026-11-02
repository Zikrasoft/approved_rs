import type { MedusaContainer } from '@medusajs/framework/types';
import type { PartDemand } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { DEMAND_MODULE } from '../modules/demand';
import { DEMAND_WINDOW_DAYS, rankDemand } from '../modules/demand/ranking';
import type DemandModuleService from '../modules/demand/service';

const DAY_MS = 86_400_000;

export const daysBack = (now: Date, days: number) =>
  new Date(now.getTime() - (days - 1) * DAY_MS);

export const demandModule = (scope: MedusaContainer) =>
  scope.resolve<DemandModuleService>(DEMAND_MODULE);

const catalogModule = (scope: MedusaContainer) =>
  scope.resolve<CatalogModuleService>(CATALOG_MODULE);

const brandAndNumber = (slug: string) => {
  const at = slug.lastIndexOf('-');
  return { brand: slug.slice(0, at), number: slug.slice(at + 1).toUpperCase() };
};

export async function identifiersOfSlugs(
  scope: MedusaContainer,
  slugs: string[],
): Promise<string[]> {
  const read = [...new Set(slugs)].map(brandAndNumber);
  const catalog = catalogModule(scope);
  const brands = await catalog.listBrands(
    { slug: read.map(({ brand }) => brand) },
    { select: ['id', 'slug'], take: null },
  );
  const brandIdOf = new Map(brands.map(({ id, slug }) => [slug, id]));
  const wanted = new Set(
    read.map(({ brand, number }) => `${brandIdOf.get(brand)}|${number}`),
  );
  const found = await catalog.listPartIdentifiers(
    {
      brand_id: brands.map(({ id }) => id),
      normalized_value: read.map(({ number }) => number),
    },
    { select: ['id', 'brand_id', 'normalized_value'], take: null },
  );
  return found
    .filter(({ brand_id, normalized_value }) =>
      wanted.has(`${brand_id}|${normalized_value}`),
    )
    .map(({ id }) => id);
}

export async function loadPartDemand(
  scope: MedusaContainer,
  now: Date = new Date(),
): Promise<Map<string, PartDemand>> {
  const counts = await demandModule(scope).countsSince(
    daysBack(now, DEMAND_WINDOW_DAYS),
  );
  if (!counts.length) return new Map();
  const identifiers = await catalogModule(scope).listPartIdentifiers(
    { id: counts.map(({ id }) => id) },
    { select: ['id', 'part.category_id'], relations: ['part'], take: null },
  );
  const categoryOf = new Map(
    identifiers.map(({ id, part }) => [id, part.category_id ?? null]),
  );
  return rankDemand(
    counts.flatMap((counted) =>
      categoryOf.has(counted.id)
        ? [{ ...counted, category_id: categoryOf.get(counted.id) ?? null }]
        : [],
    ),
  );
}
