import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  res.json({ sources: await catalog.countRowsBySource() });
}
