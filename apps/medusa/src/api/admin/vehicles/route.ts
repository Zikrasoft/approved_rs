import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { loadVehicleTree } from '../../../lib/vehicles';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({ makes: await loadVehicleTree(req.scope) });
}
