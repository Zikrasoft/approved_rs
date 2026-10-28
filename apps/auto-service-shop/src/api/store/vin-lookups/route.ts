import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { vinDecoders } from '../../../lib/vin/chain';
import { resolveVin } from '../../../lib/vin/resolve';
import { CATALOG_MODULE } from '../../../modules/catalog';
import { VIN_LOOKUP_MODULE } from '../../../modules/vin-lookup';
import { carPages } from '../../../search/catalogue-car';
import type { StoreCreateVinLookupType } from '../validators';

export async function POST(
  req: MedusaRequest<StoreCreateVinLookupType>,
  res: MedusaResponse,
): Promise<void> {
  const lookup = await resolveVin(
    req.validatedBody.vin,
    vinDecoders(req.scope),
    {
      catalog: req.scope.resolve(CATALOG_MODULE),
      vinLookups: req.scope.resolve(VIN_LOOKUP_MODULE),
    },
  );
  res.json(
    lookup.resolved
      ? {
          ...lookup,
          pages: await carPages(
            req.scope.resolve(ContainerRegistrationKeys.QUERY),
            lookup.vehicle,
          ),
        }
      : lookup,
  );
}
