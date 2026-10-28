import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { VIN_LOOKUP_MODULE } from '../../../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../../../modules/vin-lookup/service';

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
