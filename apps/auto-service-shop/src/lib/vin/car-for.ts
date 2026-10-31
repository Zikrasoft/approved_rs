import type { MedusaContainer } from '@medusajs/framework/types';
import {
  vehicleLabel,
  vinSchema,
  type Vehicle,
} from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../modules/vin-lookup';
import type VinLookupModuleService from '../../modules/vin-lookup/service';
import { listVehicleResponses } from '../store-response';
import { vinDecoders } from './chain';
import { resolveVin } from './resolve';

export async function vehicleForVin(
  scope: MedusaContainer,
  vin: string,
): Promise<Vehicle | null> {
  const [lookup] = await scope
    .resolve<VinLookupModuleService>(VIN_LOOKUP_MODULE)
    .listVinLookups({ vin });
  if (!lookup?.vehicle_id) return null;
  const [vehicle] = await listVehicleResponses(
    scope.resolve<CatalogModuleService>(CATALOG_MODULE),
    { id: [lookup.vehicle_id] },
  );
  return vehicle ?? null;
}

export async function carFor(
  scope: MedusaContainer,
  typed: string | undefined,
): Promise<string | null> {
  const vin = vinSchema.safeParse(typed);
  if (!vin.success) return null;
  await resolveVin(vin.data, vinDecoders(scope), {
    catalog: scope.resolve(CATALOG_MODULE),
    vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
  });
  const vehicle = await vehicleForVin(scope, vin.data);
  return vehicle ? vehicleLabel(vehicle) : null;
}
