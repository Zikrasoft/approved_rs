import type { MedusaContainer } from '@medusajs/framework/types';
import {
  cataloguePageListSchema,
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
import { everyRequirementFit } from './requirement-fit';

export async function cataloguePageList(scope: MedusaContainer) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const fits = await everyRequirementFit(catalog);
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
  const partsPerMake = new Map<string, number>();
  for (const { id, make } of series) {
    partsPerMake.set(
      make.slug,
      (partsPerMake.get(make.slug) ?? 0) + (countOf.get(id)?.parts ?? 0),
    );
  }
  const makes = new Map(
    series
      .filter(({ id }) => countOf.has(id))
      .map(({ make }) => [make.slug, make]),
  );
  const listed = new Map(
    perCategory.map(({ category_id, listed: n }) => [category_id, n]),
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
      listed: listed.get(id) ?? 0,
    })),
    catalogue_makes: makeListSchema.parse(catalogueMakes),
  });
}
