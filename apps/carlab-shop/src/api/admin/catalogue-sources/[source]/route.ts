import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../../../../lib/admin-errors';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { source } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const identifierIds = (
    await catalog.listPartIdentifiers(
      { source },
      { select: ['id'], take: null },
    )
  ).map(({ id }) => id);
  try {
    const deleted = await catalog.deleteRowsBySource(source);
    if (identifierIds.length) {
      await suppliers.deleteSupplierOffers({
        part_identifier_id: identifierIds,
      });
      await suppliers.deleteStagedRecords({
        part_identifier_id: identifierIds,
      });
    }
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
