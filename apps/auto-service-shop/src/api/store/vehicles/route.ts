import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { listVehicleResponses } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({
    vehicles: await listVehicleResponses(req.scope.resolve(CATALOG_MODULE)),
  });
}
