import { seriesHasPage } from '@podbor/catalog-contract';

import type CatalogModuleService from '../modules/catalog/service';
import type PublishModuleService from '../modules/publish/service';
import { vehicleRequirementFits } from './requirement-fit';
import { listVehicleResponses } from './store-response';

export type SeriesModules = {
  catalog: CatalogModuleService;
  publish: PublishModuleService;
};

export async function seriesRequirementFits(
  catalog: CatalogModuleService,
  seriesIds: string[],
) {
  const chassis = await catalog.listChassis(
    { series_id: seriesIds },
    { select: ['id'], take: null },
  );
  const models = await catalog.listVehicleModels(
    { chassis_id: chassis.map(({ id }) => id) },
    { select: ['id'], take: null },
  );
  const vehicles = models.length
    ? await listVehicleResponses(catalog, {
        model_id: models.map(({ id }) => id),
      })
    : [];
  return vehicleRequirementFits(catalog, vehicles);
}

export async function pagedSeries(
  { catalog, publish }: SeriesModules,
  seriesIds: string[],
) {
  if (!seriesIds.length) return [];
  const counts = await publish.listedPartCounts(
    await seriesRequirementFits(catalog, seriesIds),
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
