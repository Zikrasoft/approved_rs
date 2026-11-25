import type { MedusaContainer } from '@medusajs/framework/types';
import {
  cataloguePageListSchema,
  type PartDemand,
  makeListSchema,
  partPageSlug,
} from '@podbor/catalog-contract';

import { DEMAND_TTL_MS, memoized } from './catalogue-memo';
import { categoryPartPages, listedNumbersByCategory } from './category-page';
import { memoPartDemand } from './part-demand';
import {
  type CatalogueModules,
  catalogueModules,
  catalogueStructure,
} from './catalogue-structure';

async function categoryCounts(
  publish: CatalogueModules['publish'],
  demand: Map<string, PartDemand>,
) {
  return new Map(
    [...(await listedNumbersByCategory(publish))].map(
      ([categoryId, numbers]) => {
        const pages = categoryPartPages(numbers);
        return [
          categoryId,
          {
            listed: pages.length,
            demand: pages.reduce(
              (sum, { id }) => sum + (demand.get(id)?.score ?? 0),
              0,
            ),
          },
        ];
      },
    ),
  );
}

export const cataloguePageList = (scope: MedusaContainer) =>
  memoized(
    catalogueModules(scope).publish,
    'page-list',
    () => buildPageList(scope),
    DEMAND_TTL_MS,
  );

export const warmCatalogueMemo = (scope: MedusaContainer) =>
  cataloguePageList(scope);

async function buildPageList(scope: MedusaContainer) {
  const modules = catalogueModules(scope);
  const { catalog, publish } = modules;
  const structure = await catalogueStructure(modules);
  const { paged } = structure;
  const [slugs, perCategory, categories, catalogueMakes] = await Promise.all([
    publish.publishedPartSlugs(),
    memoPartDemand(scope).then((demand) => categoryCounts(publish, demand)),
    catalog.listCategories({}, { select: ['id', 'slug', 'name'], take: null }),
    catalog.listMakes(
      {},
      { select: ['slug', 'name', 'show_on_site'], order: { slug: 'ASC' } },
    ),
  ]);

  const parts = new Map<string, boolean>();
  for (const { brand_slug, normalized_value, indexable } of slugs) {
    const slug = partPageSlug(brand_slug, normalized_value);
    if (!parts.has(slug)) parts.set(slug, indexable);
  }

  const categorySlug = new Map(categories.map(({ id, slug }) => [id, slug]));
  const partsPerMake = new Map(
    (await publish.listedMakePartCounts(paged.map(({ id }) => id))).map(
      ({ make_slug, parts: held }) => [make_slug, held],
    ),
  );
  const makes = new Map(structure.stocked.map(({ make }) => [make.slug, make]));

  return cataloguePageListSchema.parse({
    parts: [...parts].map(([slug, indexable]) => ({ slug, indexable })),
    makes: [...makes.values()].map(({ slug, name }) => ({
      slug,
      name,
      hub: structure.hub(slug),
      parts: partsPerMake.get(slug) ?? 0,
    })),
    series: paged.map(({ slug, name, make, categoryIds }) => ({
      make: make.slug,
      slug,
      name,
      categories: categoryIds
        .flatMap((id) => categorySlug.get(id) ?? [])
        .sort(),
    })),
    categories: categories.map(({ id, slug, name }) => ({
      slug,
      name,
      listed: perCategory.get(id)?.listed ?? 0,
      demand: perCategory.get(id)?.demand ?? 0,
    })),
    catalogue_makes: makeListSchema.parse(catalogueMakes),
  });
}
