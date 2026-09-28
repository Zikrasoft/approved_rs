import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { catalogVersionOf } from '../../../lib/catalog-version';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: 'store', fields: ['metadata'] });
  res.json({ version: catalogVersionOf(data[0]?.metadata) });
}
