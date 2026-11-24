import type { MedusaContainer } from '@medusajs/framework/types';
import {
  cataloguePageListSchema,
  type PartDemand,
  makeHasPage,
  makeListSchema,
  partPageSlug,
  seriesCategoryHasPage,
  seriesHasPage,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import { loadPartDemand } from './part-demand';
import { everyRequirementFit } from './requirement-fit';

async function demandPerCategory(
  publish: PublishModuleService,
  categories: { id: string }[],
  demand: Map<string, PartDemand>,
) {
  const sums = new Map<string, number>();
  if (!demand.size) return sums;
  for (const { id } of categories) {
    const seen = new Set<string>();
    let sum = 0;
    for (const number of await publish.listedNumbersIn(id)) {
      const slug = partPageSlug(number.brand_slug, number.normalized_value);
      if (!seen.has(slug)) {
        seen.add(slug);
        sum += demand.get(number.id)?.score ?? 0;
      }
    }
    sums.set(id, sum);
  }
  return sums;
}

export async function cataloguePageList(scope: MedusaContainer) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const fits = await everyRequirementFit(catalog);
  const demand = await loadPartDemand(scope);
  const [
    slugs,
    counts,
    seriesCategories,
    perCategory,
    series,
    categories,
    catalogueMakes,
  ] = await Promise.all([
    publish.publishedPartSlugs(),
    publish.listedPartCounts(fits),
    publish.listedSeriesCategoryCounts(fits),
    publish.listedPerCategory(),
    catalog.listSeries({}, { relations: ['make'], take: null }),
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

  const countOf = new Map(counts.map((row) => [row.series_id, row]));
  const categorySlug = new Map(categories.map(({ id, slug }) => [id, slug]));
  const categoriesOf = new Map<string, string[]>();
  for (const { series_id, category_id, parts: held } of seriesCategories) {
    const slug = categorySlug.get(category_id);
    if (slug && seriesCategoryHasPage(held)) {
      categoriesOf.set(series_id, [
        ...(categoriesOf.get(series_id) ?? []),
        slug,
      ]);
    }
  }

  const paged = series.filter(({ id }) =>
    seriesHasPage(countOf.get(id) ?? { parts: 0, required: 0 }),
  );
  const pagedPerMake = new Map<string, number>();
  for (const { make } of paged) {
    pagedPerMake.set(make.slug, (pagedPerMake.get(make.slug) ?? 0) + 1);
  }
  const partsPerMake = new Map(
    (
      await publish.listedMakePartCounts(
        fits,
        paged.map(({ id }) => id),
      )
    ).map(({ make_slug, parts: held }) => [make_slug, held]),
  );
  const makes = new Map(
    series
      .filter(({ id }) => countOf.has(id))
      .map(({ make }) => [make.slug, make]),
  );
  const listed = new Map(
    perCategory.map(({ category_id, listed: n }) => [category_id, n]),
  );

  const demandOf = await demandPerCategory(publish, categories, demand);

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
      listed: listed.get(id) ?? 0,
      demand: demandOf.get(id) ?? 0,
    })),
    catalogue_makes: makeListSchema.parse(catalogueMakes),
  });
}
