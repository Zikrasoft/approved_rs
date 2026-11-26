import type { Vehicle } from '@podbor/catalog-contract';

import type CatalogModuleService from '../modules/catalog/service';
import { listVehicleResponses } from './store-response';

export const vehiclesOfSeries = (
  catalog: CatalogModuleService,
  seriesIds: string[],
): Promise<Vehicle[]> =>
  listVehicleResponses(catalog, { series_id: seriesIds });
