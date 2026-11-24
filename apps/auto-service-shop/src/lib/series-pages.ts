import { seriesHasPage } from '@podbor/catalog-contract';

import type CatalogModuleService from '../modules/catalog/service';
import type PublishModuleService from '../modules/publish/service';
import { vehicleRequirementFits } from './requirement-fit';
import { vehiclesOfSeries } from './series-vehicles';

export type SeriesModules = {
  catalog: CatalogModuleService;
  publish: PublishModuleService;
};

export async function pagedSeries(
  { catalog, publish }: SeriesModules,
  seriesIds: string[],
) {
  if (!seriesIds.length) return [];
  const counts = await publish.listedPartCounts(
    await vehicleRequirementFits(
      catalog,
      await vehiclesOfSeries(catalog, seriesIds),
    ),
    seriesIds,
  );
  const series = await catalog.listSeries(
    { id: seriesIds },
    { relations: ['make'], take: null },
  );
  return series.filter(({ id }) =>
    seriesHasPage(
      counts.find(({ series_id }) => series_id === id) ?? {
        parts: 0,
        required: 0,
      },
    ),
  );
}
