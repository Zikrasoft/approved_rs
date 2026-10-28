import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { catalogueRedirects } from '../../../lib/catalogue-redirects';
import { CATALOG_MODULE } from '../../../modules/catalog';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({
    redirects: await catalogueRedirects(req.scope.resolve(CATALOG_MODULE)),
  });
}
