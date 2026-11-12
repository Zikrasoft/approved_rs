import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  vehicleLabel,
  vehicleName,
  type Vehicle,
} from '@podbor/catalog-contract';
import {
  VISITOR_VIN_LOOKUPS_SHOWN,
  type VisitorVinLookup,
} from '@podbor/lead-crm/visitor-searches-wire';
import { z } from 'zod';

import { listVehicleResponses } from '../../../../../lib/store-response';
import { openDataReference } from '../../../../../lib/vin/open-data-reference';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../../modules/vin-lookup/service';

const unresolvedModel = (make: string | null, code: string | null) => {
  const reference = make && code ? openDataReference(make, code) : null;
  return reference ? `${reference.model} ${reference.chassis}` : code;
};

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const visitorId = z.uuid().safeParse(req.params.visitor_id);
  if (!visitorId.success) {
    res.status(400).json({
      type: 'invalid_data',
      message: 'visitor_id must be a uuid',
    });
    return;
  }
  const lookups = await req.scope
    .resolve<VinLookupModuleService>(VIN_LOOKUP_MODULE)
    .visitorLookups(visitorId.data, VISITOR_VIN_LOOKUPS_SHOWN);
  const catalog = req.scope.resolve<CatalogModuleService>(CATALOG_MODULE);
  const vehicleIds = lookups.flatMap(({ vehicle_id }) => vehicle_id ?? []);
  const vehicles = new Map<string, Vehicle>(
    (vehicleIds.length
      ? await listVehicleResponses(catalog, { id: vehicleIds })
      : []
    ).map((vehicle) => [vehicle.id, vehicle]),
  );
  const makeSlugs = lookups.flatMap(({ make }) => make ?? []);
  const makes = new Map(
    (makeSlugs.length
      ? await catalog.listMakes(
          { slug: makeSlugs },
          { select: ['slug', 'name'] },
        )
      : []
    ).map(({ slug, name }) => [slug, name]),
  );
  res.json({
    lookups: lookups.map(({ vin, make, code, vehicle_id, at }) => {
      const vehicle = vehicle_id ? vehicles.get(vehicle_id) : undefined;
      return {
        make: vehicle
          ? vehicleName(vehicle.model).make
          : make && (makes.get(make) ?? make),
        model: vehicle
          ? vehicleName(vehicle.model).model
          : unresolvedModel(make, code),
        vin_last4: vin?.slice(-4) ?? null,
        at: at.toISOString(),
        vehicle: vehicle ? vehicleLabel(vehicle) : null,
      } satisfies VisitorVinLookup;
    }),
  });
}
