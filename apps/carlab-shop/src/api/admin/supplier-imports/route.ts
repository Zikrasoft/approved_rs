import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { importSupplierCatalogues } from '../../../lib/suppliers/import';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({ imports: await importSupplierCatalogues(req.scope) });
}
