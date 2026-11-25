import type { Vehicle } from '@podbor/catalog-contract';

import type CatalogModuleService from '../modules/catalog/service';
import { listVehicleResponses } from './store-response';

export async function vehiclesOfSeries(
  catalog: CatalogModuleService,
  seriesIds: string[],
): Promise<Vehicle[]> {
  if (!seriesIds.length) return [];
  const chassis = await catalog.listChassis(
    { series_id: seriesIds },
    { select: ['id'], take: null },
  );
  if (!chassis.length) return [];
  const models = await catalog.listVehicleModels(
    { chassis_id: chassis.map(({ id }) => id) },
    { select: ['id'], take: null },
  );
  return models.length
    ? listVehicleResponses(catalog, { model_id: models.map(({ id }) => id) })
    : [];
}
