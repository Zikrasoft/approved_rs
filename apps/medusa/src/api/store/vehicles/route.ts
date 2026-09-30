import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { vehicleTreeSchema } from '@podbor/shop-catalog';

import { publicVehicleTree } from '../../../lib/vehicle-tree';
import { loadVehicleTree } from '../../../lib/vehicles';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json(
    vehicleTreeSchema.parse(
      publicVehicleTree(await loadVehicleTree(req.scope)),
    ),
  );
}
