import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { cataloguePartsHubSchema } from '@podbor/catalog-contract';

import { cataloguePageList } from '../../../../lib/catalogue-page-list';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json(cataloguePartsHubSchema.parse(await cataloguePageList(req.scope)));
}
