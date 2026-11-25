import type { MedusaContainer } from '@medusajs/framework/types';
import {
  cataloguePageListSchema,
  type PartDemand,
  makeListSchema,
  partPageSlug,
} from '@podbor/catalog-contract';

import type { ListedNumber } from '../modules/publish/service';
import { categoryPartPages } from './category-page';
import { loadPartDemand } from './part-demand';
import {
  type CatalogueModules,
  catalogueModules,
  catalogueStructure,
} from './catalogue-structure';

async function categoryCounts(
  publish: CatalogueModules['publish'],
  demand: Map<string, PartDemand>,
) {
  const numbersOf = new Map<string, ListedNumber[]>();
  for (const number of await publish.listedNumbersIn(null)) {
    numbersOf.set(number.category_id, [
      ...(numbersOf.get(number.category_id) ?? []),
      number,
    ]);
  }
  return new Map(
    [...numbersOf].map(([categoryId, numbers]) => {
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
    }),
  );
}

export async function cataloguePageList(scope: MedusaContainer) {
  const modules = catalogueModules(scope);
  const { catalog, publish } = modules;
  const structure = await catalogueStructure(modules);
  const { paged } = structure;
  const [slugs, perCategory, categories, catalogueMakes] = await Promise.all([
    publish.publishedPartSlugs(),
    loadPartDemand(scope).then((demand) => categoryCounts(publish, demand)),
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
