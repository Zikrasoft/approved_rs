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

import { loadPartDemand } from './part-demand';
import {
  type CatalogueModules,
  catalogueModules,
  seriesWithPages,
} from './series-pages';

async function demandPerCategory(
  publish: CatalogueModules['publish'],
  demand: Map<string, PartDemand>,
) {
  const sums = new Map<string, number>();
  if (!demand.size) return sums;
  const seen = new Set<string>();
  for (const number of await publish.listedNumbersIn(null)) {
    const slug = partPageSlug(number.brand_slug, number.normalized_value);
    const key = `${number.category_id}/${slug}`;
    if (!seen.has(key)) {
      seen.add(key);
      sums.set(
        number.category_id,
        (sums.get(number.category_id) ?? 0) +
          (demand.get(number.id)?.score ?? 0),
      );
    }
  }
  return sums;
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
  const [slugs, perCategory, categories, catalogueMakes, demandOf] =
    await Promise.all([
      publish.publishedPartSlugs(),
      publish.listedPerCategory(),
      catalog.listCategories(
        {},
        { select: ['id', 'slug', 'name'], take: null },
      ),
      catalog.listMakes(
        {},
        { select: ['slug', 'name', 'show_on_site'], order: { slug: 'ASC' } },
      ),
      loadPartDemand(scope).then((demand) =>
        demandPerCategory(publish, demand),
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
      demand: demandOf.get(id) ?? 0,
    })),
    catalogue_makes: makeListSchema.parse(catalogueMakes),
  });
}
