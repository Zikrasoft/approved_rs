import type { MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from '@medusajs/framework/zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import { MANUAL_SOURCE } from '../../modules/catalog/models/provenance';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import type SupplierModuleService from '../../modules/supplier/service';
import { emitIndexChanges } from '../index-changes';

export const MANUAL_SUPPLIER = MANUAL_SOURCE;
export const MANUAL_MARKUP_PERCENTAGE = 20;
export const MAX_MANUAL_COST_PRICE = 10_000_000;
export const MAX_MANUAL_STOCK = 100_000;
export const MAX_LEAD_TIME_DAYS = 365;

export const manualOfferSchema = z
  .strictObject({
    cost_price: z.number().positive().max(MAX_MANUAL_COST_PRICE),
    stock_quantity: z.number().int().min(0).max(MAX_MANUAL_STOCK),
    lead_time_days: z.number().int().min(0).max(MAX_LEAD_TIME_DAYS),
  })
  .refine(
    ({ stock_quantity, lead_time_days }) =>
      stock_quantity > 0 || lead_time_days > 0,
    { path: ['availability'], message: 'Needs stock or a lead time' },
  );

export type ManualOffer = z.infer<typeof manualOfferSchema>;

async function manualSupplierId(
  suppliers: SupplierModuleService,
  actorId: string,
): Promise<string> {
  const [existing] = await suppliers.listSuppliers({ name: MANUAL_SUPPLIER });
  if (existing) {
    return existing.id;
  }
  const created = await suppliers.createSuppliers({
    name: MANUAL_SUPPLIER,
    markup_percentage: MANUAL_MARKUP_PERCENTAGE,
    import_enabled: false,
    created_by: actorId,
    updated_by: actorId,
  });
  return created.id;
}

export async function saveManualOffer(
  scope: MedusaContainer,
  partIdentifierId: string,
  offer: ManualOffer,
  actorId: string,
) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const identifier = await catalog.retrievePartIdentifier(partIdentifierId);
  const supplierId = await manualSupplierId(suppliers, actorId);
  const key = { supplier_id: supplierId, supplier_article_id: identifier.id };
  const fields = {
    ...key,
    part_identifier_id: identifier.id,
    ...offer,
    stock_by_location: {},
    updated_by: actorId,
  };
  const [existing] = await suppliers.listSupplierOffers(key);
  const saved = await (existing
    ? suppliers.updateSupplierOffers({ id: existing.id, ...fields })
    : suppliers.createSupplierOffers({ ...fields, created_by: actorId }));
  await emitIndexChanges(scope, { partIds: [identifier.part_id] });
  return saved;
}

export async function deleteManualOffer(
  scope: MedusaContainer,
  partIdentifierId: string,
): Promise<void> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const identifier = await catalog.retrievePartIdentifier(partIdentifierId);
  const [supplier] = await suppliers.listSuppliers({ name: MANUAL_SUPPLIER });
  const [existing] = supplier
    ? await suppliers.listSupplierOffers({
        supplier_id: supplier.id,
        supplier_article_id: identifier.id,
      })
    : [];
  if (!existing) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No manual offer for ${partIdentifierId}`,
    );
  }
  await suppliers.deleteSupplierOffers(existing.id);
  await emitIndexChanges(scope, { partIds: [identifier.part_id] });
}
