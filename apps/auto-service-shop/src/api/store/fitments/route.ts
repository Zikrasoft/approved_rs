import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { fitmentsResponseSchema } from '@podbor/catalog-contract';

import { toFitmentResponse } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { StoreListFitmentsType } from '../validators';

export async function GET(
  req: MedusaRequest<unknown, StoreListFitmentsType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit } = req.validatedQuery as StoreListFitmentsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const [fitments, count] = await catalog.listAndCountFitments(
    {},
    { order: { id: 'ASC' }, skip: offset, take: limit },
  );

  res.json(
    fitmentsResponseSchema.parse({
      fitments: fitments.map(toFitmentResponse),
      count,
      offset,
      limit,
    }),
  );
}
