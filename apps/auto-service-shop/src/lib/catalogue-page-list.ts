import type { MedusaContainer } from '@medusajs/framework/types';
import {
  cataloguePageListSchema,
  type PartDemand,
  makeHasPage,
  makeListSchema,
  partPageSlug,
  seriesCategoryHasPage,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import type { ListedNumber } from '../modules/publish/service';
import { categoryPartPages } from './category-page';
import { loadPartDemand } from './part-demand';
import {
  type CatalogueModules,
  catalogueModules,
  seriesWithPages,
} from './series-pages';

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
  const {
    series,
    counts,
    paged,
    held: seriesCategories,
  } = await seriesWithPages(modules, {});
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
  const categoriesOf = new Map<string, string[]>();
  for (const { series_id, category_id, parts: held } of seriesCategories) {
    const slug = category_id && categorySlug.get(category_id);
    if (slug && seriesCategoryHasPage(held)) {
      categoriesOf.set(series_id, [
        ...(categoriesOf.get(series_id) ?? []),
        slug,
      ]);
    }
  }

  const pagedPerMake = new Map<string, number>();
  for (const { make } of paged) {
    pagedPerMake.set(make.slug, (pagedPerMake.get(make.slug) ?? 0) + 1);
  }
  const partsPerMake = new Map(
    (await publish.listedMakePartCounts(paged.map(({ id }) => id))).map(
      ({ make_slug, parts: held }) => [make_slug, held],
    ),
  );
  const makes = new Map(
    series
      .filter(({ id }) => counts.has(id))
      .map(({ make }) => [make.slug, make]),
  );

  return cataloguePageListSchema.parse({
    parts: [...parts].map(([slug, indexable]) => ({ slug, indexable })),
    makes: [...makes.values()].map(({ slug, name }) => ({
      slug,
      name,
      hub: makeHasPage(pagedPerMake.get(slug) ?? 0),
      parts: partsPerMake.get(slug) ?? 0,
    })),
    series: paged.map(({ id, name, make }) => ({
      make: make.slug,
      slug: seriesSlugOf(name),
      name,
      categories: [...(categoriesOf.get(id) ?? [])].sort(),
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
