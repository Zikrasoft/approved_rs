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
import type { LookupOrigin } from './sources';
import { vagReference } from './vag-model-codes';

type Unresolved = Extract<
  Awaited<ReturnType<typeof resolveVin>>,
  { resolved: false }
>;

export type VinGeneration = {
  make: string;
  model_slug: string | null;
  code: string | null;
  chassis: string | null;
  model: string | null;
};

export function generationOf({
  make,
  code,
  model_slug,
}: Unresolved): VinGeneration | null {
  if (!make || !(model_slug || code)) return null;
  const reference = code ? vagReference(make, code) : null;
  return {
    make,
    model_slug,
    code,
    chassis: reference?.chassis ?? null,
    model: reference?.model ?? null,
  };
}

export async function generationForVin(
  scope: MedusaContainer,
  typed: string | undefined,
  origin: LookupOrigin,
): Promise<VinGeneration | null> {
  const vin = vinSchema.safeParse(typed);
  if (!vin.success) return null;
  const result = await resolveVin(
    vin.data,
    vinDecoders(scope),
    {
      catalog: scope.resolve(CATALOG_MODULE),
      vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
    },
    origin,
  );
  return result.resolved ? null : generationOf(result);
}

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
  origin: LookupOrigin,
): Promise<string | null> {
  const vin = vinSchema.safeParse(typed);
  if (!vin.success) return null;
  await resolveVin(
    vin.data,
    vinDecoders(scope),
    {
      catalog: scope.resolve(CATALOG_MODULE),
      vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
    },
    origin,
  );
  const vehicle = await vehicleForVin(scope, vin.data);
  return vehicle ? vehicleLabel(vehicle) : null;
}
