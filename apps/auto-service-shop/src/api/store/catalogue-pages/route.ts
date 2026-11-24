import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { cataloguePageList } from '../../../lib/catalogue-page-list';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json(await cataloguePageList(req.scope));
}
