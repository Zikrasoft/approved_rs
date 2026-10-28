import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../../../../../../lib/admin-errors';
import { createdBy } from '../../../../../../lib/editors';
import { LINKABLE_CODE_TYPES } from '../../../../../../lib/vin/linkable';
import { CATALOG_MODULE } from '../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../../../modules/vin-lookup/service';
import type { AdminLinkVinCodeType } from '../../../../validators';
import { IDENTIFIER_FORMATS } from '../../../../vehicle-validators';

const invalid = (field: string, message: string) =>
  adminError(MedusaError.Types.INVALID_DATA, 'INVALID_FIELD', message, {
    field,
  });

export async function POST(
  req: AuthenticatedMedusaRequest<AdminLinkVinCodeType>,
  res: MedusaResponse,
): Promise<void> {
  const { make, code } = req.params;
  const type = LINKABLE_CODE_TYPES[make];
  if (!type || !IDENTIFIER_FORMATS[type].test(code)) {
    throw invalid('code', 'code: Only a BMW type code can be linked');
  }
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const ids = [...new Set(req.validatedBody.vehicle_ids)];
  const vehicles = await catalog.listVehicles(
    { id: ids },
    { relations: ['model.chassis.series.make'], take: null },
  );
  if (
    vehicles.length !== ids.length ||
    vehicles.some(({ model }) => model.chassis.series.make.slug !== make)
  ) {
    throw invalid('vehicle_ids', `vehicle_ids: Choose Vehicles of ${make}`);
  }
  const linked = new Set(
    (
      await catalog.listVehicleIdentifiers(
        { type, value: code, vehicle_id: ids, supplier_id: null },
        { select: ['vehicle_id'], take: null },
      )
    ).map(({ vehicle_id }) => vehicle_id),
  );
  const fresh = ids.filter((id) => !linked.has(id));
  if (fresh.length) {
    await catalog.createVehicleIdentifiers(
      fresh.map((vehicle_id) => ({
        vehicle_id,
        type,
        value: code,
        ...createdBy(req),
      })),
    );
  }

  res.json({ make, code, linked: fresh.length });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { make, code } = req.params;
  const vinLookups: VinLookupModuleService =
    req.scope.resolve(VIN_LOOKUP_MODULE);

  const ids = (
    await vinLookups.listVinLookups(
      { make, code, vehicle_id: null },
      { select: ['id'], take: null },
    )
  ).map(({ id }) => id);
  if (ids.length) {
    await vinLookups.deleteVinLookups(ids);
  }

  res.json({ make, code, deleted: ids.length });
}
