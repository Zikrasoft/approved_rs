import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import type { AdminBulkDetachFitmentsType } from '../../../validators';

export async function POST(
  req: MedusaRequest<AdminBulkDetachFitmentsType>,
  res: MedusaResponse,
): Promise<void> {
  const { part_id, ...filter } = req.validatedBody;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  res.json(await catalog.detachPartFromVehicles(part_id, filter));
}
