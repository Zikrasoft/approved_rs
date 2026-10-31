import type { MedusaContainer } from '@medusajs/framework/types';
import { vinSchema } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../../modules/catalog';
import { VIN_LOOKUP_MODULE } from '../../modules/vin-lookup';
import { carLabel } from '../order-lead';
import { vinDecoders } from './chain';
import { resolveVin } from './resolve';

export async function carFor(
  scope: MedusaContainer,
  typed: string | undefined,
): Promise<string | null> {
  const vin = vinSchema.safeParse(typed);
  if (!vin.success) return null;
  const lookup = await resolveVin(vin.data, vinDecoders(scope), {
    catalog: scope.resolve(CATALOG_MODULE),
    vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
  });
  return lookup.resolved ? carLabel(lookup.vehicle) : null;
}
