import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';

import { nearestPagedPlace } from '../../../lib/car-pages';
import { logEvent, vinFields } from '../../../lib/log-event';
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
  const { vin, bot, visitor_id } = req.validatedBody;
  const lookup = await resolveVin(
    vin,
    vinDecoders(req.scope),
    { catalog, vinLookups: req.scope.resolve(VIN_LOOKUP_MODULE) },
    { source: 'storefront', bot, visitor_id },
  );
  logEvent(
    'vin.lookup',
    lookup.resolved
      ? {
          outcome: 'resolved',
          reason: null,
          make: lookup.vehicle.model.chassis.series.make.slug,
          code: null,
          ...vinFields(vin),
          candidates: 1,
        }
      : {
          outcome: 'unresolved',
          reason: !lookup.make
            ? 'not_decoded'
            : lookup.vehicle_ids.length > 1
              ? 'ambiguous'
              : 'no_vehicle',
          make: lookup.make,
          code: lookup.code,
          ...vinFields(vin),
          candidates: lookup.vehicle_ids.length,
        },
    req.requestId ?? null,
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
      lookup.resolved ? null : lookup.make,
    ),
  });
}
