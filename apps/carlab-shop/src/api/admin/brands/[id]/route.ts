import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveBrand(id);

  const [, used] = await catalog.listAndCountPartIdentifiers(
    { brand_id: id },
    { take: 1 },
  );
  if (used) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Brand ${id} is used by ${used} part numbers`,
    );
  }

  await catalog.deleteBrands(id);

  res.json({ id, object: 'brand', deleted: true });
}
