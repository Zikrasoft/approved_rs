import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { makesPage } from '../../../../lib/catalogue-makes';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json(await makesPage(req.scope));
}
