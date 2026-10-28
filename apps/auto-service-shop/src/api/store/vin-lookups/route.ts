import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';

import { nearestPagedPlace } from '../../../lib/car-pages';
import { vinDecoders } from '../../../lib/vin/chain';
import { resolveVin } from '../../../lib/vin/resolve';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../modules/vin-lookup';
import type { StoreCreateVinLookupType } from '../validators';

export async function POST(
  req: MedusaRequest<StoreCreateVinLookupType>,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const lookup = await resolveVin(
    req.validatedBody.vin,
    vinDecoders(req.scope),
    { catalog, vinLookups: req.scope.resolve(VIN_LOOKUP_MODULE) },
  );
  const candidates = lookup.resolved
    ? [lookup.vehicle]
    : lookup.vehicle_ids.length
      ? await catalog.listVehicles(
          { id: lookup.vehicle_ids },
          { relations: ['model.chassis.series.make'], take: null },
        )
      : [];
  res.json({
    ...lookup,
    place: await nearestPagedPlace(
      req.scope.resolve(Modules.SEARCH),
      candidates,
      lookup.resolved ? null : lookup.model_slug,
    ),
  });
}
