import type { MedusaContainer } from '@medusajs/framework/types';
import {
  carMakePageResponseSchema,
  MAKE_TOP_CATEGORIES,
  makeHasPage,
  partPageSlug,
  seriesHasPage,
  showcaseOf,
  type CarMakePageResponse,
  type CatalogLocale,
} from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { vehicleRequirementFits } from './requirement-fit';
import { pagesOfParts } from './series-page';
import { vehiclesOfSeries } from './series-vehicles';

const NO_PARTS = { parts: 0, required: 0 };

export async function carMakePageAt(
  scope: MedusaContainer,
  slug: string,
  { locale, shown }: { locale: CatalogLocale; shown: boolean },
): Promise<CarMakePageResponse | null> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const [make] = await catalog.listMakes({ slug }, { take: 1 });
  if (!make) return null;
  const series = await catalog.listSeries({ make_id: make.id }, { take: null });
  const seriesIds = series.map(({ id }) => id);
  const vehicles = await vehiclesOfSeries(catalog, seriesIds);
  const fits = await vehicleRequirementFits(catalog, vehicles);
  const counts = await publish.listedPartCounts(fits, seriesIds);
  const hub = makeHasPage(
    series.filter(({ id }) =>
      seriesHasPage(counts.find((row) => row.series_id === id) ?? NO_PARTS),
    ).length,
  );
  const places = (
    await Promise.all(
      seriesIds.map((id) => publish.listedSeriesParts(fits, id)),
    )
  ).flat();
  const byCategory = new Map<string, Set<string>>();
  for (const { category_id, part_id } of places) {
    if (category_id) {
      byCategory.set(
        category_id,
        (byCategory.get(category_id) ?? new Set()).add(part_id),
      );
    }
  }
  if (byCategory.size === 0) return null;
  const categories = await catalog.listCategories(
    { id: [...byCategory.keys()] },
    { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' }, take: null },
  );
  const top = [...categories]
    .sort((a, b) => byCategory.get(b.id)!.size - byCategory.get(a.id)!.size)
    .slice(0, MAKE_TOP_CATEGORIES);
  const queues = await Promise.all(
    top.map(async (category) => {
      const partIds = [...byCategory.get(category.id)!].sort();
      const pages = await pagesOfParts({ catalog, publish, scope }, partIds, {
        locale,
        shown,
      });
      const shownOne = shownCategory(category);
      return partIds
        .map((id) =>
          pages
            .filter(({ part }) => part.id === id)
            .map((page) => ({
              ...page,
              slug: partPageSlug(page.brand.slug, page.normalized_value),
              category: shownOne,
            })),
        )
        .filter((own) => own.length > 0);
    }),
  );
  return carMakePageResponseSchema.parse({
    hub,
    categories: top.map(shownCategory),
    showcase: showcaseOf(queues),
  });
}
