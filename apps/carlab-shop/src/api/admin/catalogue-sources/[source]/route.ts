import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { emitIndexChanges } from '../../../../lib/index-changes';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { source } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    { source },
    { select: ['id', 'part_id'], take: null },
  );
  const identifierIds = identifiers.map(({ id }) => id);
  const deleted = await catalog.deleteRowsBySource(source);
  if (identifierIds.length) {
    await suppliers.deleteSupplierOffers({
      part_identifier_id: identifierIds,
    });
    await suppliers.deleteStagedRecords({
      part_identifier_id: identifierIds,
    });
    await emitIndexChanges(req.scope, {
      deletedIdentifierIds: identifierIds,
      partIds: identifiers.map(({ part_id }) => part_id),
    });
  }
  const [supplier] = await suppliers.listSuppliers({ name: source });
  if (supplier?.import_enabled) {
    await suppliers.updateSuppliers({
      id: supplier.id,
      import_enabled: false,
      updated_by: req.auth_context.actor_id,
    });
  }
  res.json({ source, deleted, import_disabled: Boolean(supplier) });
}
