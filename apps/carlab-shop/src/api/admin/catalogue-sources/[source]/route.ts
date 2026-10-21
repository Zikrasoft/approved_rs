import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../../../../lib/admin-errors';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { source } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  try {
    const deleted = await catalog.deleteRowsBySource(source);
    res.json({ source, deleted });
  } catch (error) {
    if (
      MedusaError.isMedusaError(error) &&
      error.type === MedusaError.Types.NOT_FOUND
    ) {
      throw adminError(
        MedusaError.Types.NOT_ALLOWED,
        'SOURCE_IN_USE',
        `Rows of other sources still use rows of ${source}`,
      );
    }
    throw error;
  }
}
