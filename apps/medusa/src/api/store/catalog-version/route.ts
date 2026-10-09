import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { catalogVersionOf } from '../../../lib/catalog-version';
import { metadataRowSchema } from '../../../lib/metadata';
import { selectOne } from '../../../lib/query';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const store = await selectOne(query, 'store', metadataRowSchema, {});
  res.json({ version: catalogVersionOf(store?.metadata) });
}
