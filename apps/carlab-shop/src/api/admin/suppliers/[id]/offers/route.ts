import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../../../../../lib/admin-errors';
import { emitIndexChanges } from '../../../../../lib/index-changes';
import { MANUAL_SUPPLIER } from '../../../../../lib/suppliers/manual-offers';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const supplier = await suppliers.retrieveSupplier(req.params.id);
  if (supplier.name === MANUAL_SUPPLIER) {
    throw adminError(
      MedusaError.Types.NOT_ALLOWED,
      'MANUAL_SOURCE',
      'Manual offers are removed one by one on their brand-number',
    );
  }
  const offers = await suppliers.listSupplierOffers(
    { supplier_id: supplier.id },
    { select: ['id', 'part_identifier_id'], take: null },
  );
  if (offers.length) {
    await suppliers.deleteSupplierOffers(offers.map(({ id }) => id));
    const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
    const identifiers = await catalog.listPartIdentifiers(
      { id: [...new Set(offers.map((offer) => offer.part_identifier_id))] },
      { select: ['part_id'], take: null },
    );
    await emitIndexChanges(req.scope, {
      partIds: identifiers.map(({ part_id }) => part_id),
    });
  }
  await suppliers.updateSuppliers({
    id: supplier.id,
    import_enabled: false,
    updated_by: req.auth_context.actor_id,
  });
  res.json({ deleted: offers.length });
}
