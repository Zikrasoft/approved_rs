import type { MedusaContainer } from '@medusajs/framework/types';
import {
  makeHasPage,
  makePageResponseSchema,
  makesPageResponseSchema,
  seriesCategoryHasPage,
  seriesHasPage,
  translated,
  type CatalogLocale,
  type MakePageResponse,
  type MakesPageResponse,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import { everyRequirementFit } from './requirement-fit';
import { seriesRequirementFits } from './series-pages';

const NO_PARTS = { parts: 0, required: 0 };

export async function makesPage(
  scope: MedusaContainer,
): Promise<MakesPageResponse> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const counts = await publish.listedPartCounts(
    await everyRequirementFit(catalog),
  );
  const countOf = new Map(counts.map((row) => [row.series_id, row]));
  const series = await catalog.listSeries(
    {},
    { relations: ['make'], take: null },
  );
  const makes = new Map<string, { slug: string; name: string }>();
  for (const { id, make } of series) {
    if (seriesHasPage(countOf.get(id) ?? NO_PARTS)) {
      makes.set(make.slug, { slug: make.slug, name: make.name });
    }
  }
  return makesPageResponseSchema.parse({
    makes: [...makes.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  });
}

export async function makePageAt(
  scope: MedusaContainer,
  slug: string,
  { locale }: { locale: CatalogLocale },
): Promise<MakePageResponse | null> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const [make] = await catalog.listMakes({ slug }, { take: 1 });
  if (!make) return null;
  const series = await catalog.listSeries({ make_id: make.id }, { take: null });
  const seriesIds = series.map(({ id }) => id);
  const fits = await seriesRequirementFits(catalog, seriesIds);
  const counts = new Map(
    (await publish.listedPartCounts(fits, seriesIds)).map((row) => [
      row.series_id,
      row,
    ]),
  );
  const paged = series.filter(({ id }) =>
    seriesHasPage(counts.get(id) ?? NO_PARTS),
  );
  if (!makeHasPage(paged.length)) return null;
  const categories = await catalog.listCategories(
    {},
    { order: { slug: 'ASC' }, take: null },
  );
  const held = await publish.listedSeriesCategoryCounts(fits);
  const categoriesOf = (seriesId: string) =>
    categories
      .filter(({ id }) =>
        held.some(
          (row) =>
            row.series_id === seriesId &&
            row.category_id === id &&
            seriesCategoryHasPage(row.parts),
        ),
      )
      .map((category) => translated(category, 'name', locale));
  return makePageResponseSchema.parse({
    make: { slug: make.slug, name: make.name },
    series: paged.map((entry) => ({
      slug: seriesSlugOf(entry.name),
      name: translated(entry, 'name', locale),
      categories: categoriesOf(entry.id),
    })),
  });
}
