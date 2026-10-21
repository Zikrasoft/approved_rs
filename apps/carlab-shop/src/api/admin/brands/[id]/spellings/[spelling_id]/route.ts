import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../modules/catalog/service';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, spelling_id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const spelling = await catalog.retrieveBrandSpelling(spelling_id);
  if (spelling.brand_id !== id) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Spelling ${spelling_id} does not belong to Brand ${id}`,
    );
  }

  await catalog.deleteBrandSpellings(spelling_id);

  res.json({ id: spelling_id, object: 'brand_spelling', deleted: true });
}
