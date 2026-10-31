import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../../../../lib/catalogue-writer';
import { emitIndexChanges } from '../../../../lib/index-changes';
import { sweepOrphans } from '../../../../lib/publish/orphans';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import { updatedBy } from '../../../../lib/editors';

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { source } = req.params;
  const run = await claimCatalogueWriter(req.scope, {
    kind: 'deletion',
    created_by: req.auth_context?.actor_id ?? null,
  });
  res.json(
    await holdCatalogueWriter(req.scope, run.id, () =>
      deleteSource(req, source),
    ),
  );
}

async function deleteSource(req: AuthenticatedMedusaRequest, source: string) {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    { source },
    { select: ['id', 'part_id'], take: null },
  );
  const identifierIds = identifiers.map(({ id }) => id);
  const deleted = await catalog.deleteRowsBySource(source);
  await sweepOrphans(req.scope);
  if (identifierIds.length) {
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
      ...updatedBy(req),
    });
  }
  return { source, deleted, import_disabled: Boolean(supplier) };
}
