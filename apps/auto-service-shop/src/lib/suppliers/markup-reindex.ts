import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import type SupplierModuleService from '../../modules/supplier/service';
import { emitIndexChanges } from '../index-changes';

export const SUPPLIER_MARKUP_CHANGED_EVENT =
  'suppliers.supplier.markup_changed';

const ID_BATCH = 5000;

export async function announceMarkupChange(
  scope: MedusaContainer,
  supplierId: string,
): Promise<void> {
  await scope
    .resolve(Modules.EVENT_BUS)
    .emit({ name: SUPPLIER_MARKUP_CHANGED_EVENT, data: { id: supplierId } });
}

export async function reindexSupplierOffers(
  scope: MedusaContainer,
  supplierId: string,
): Promise<void> {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const offers = await suppliers.listSupplierOffers(
    { supplier_id: supplierId },
    { select: ['part_identifier_id'], take: null },
  );
  const identifierIds = [
    ...new Set(offers.map(({ part_identifier_id }) => part_identifier_id)),
  ];
  const partIds = new Set<string>();
  for (let start = 0; start < identifierIds.length; start += ID_BATCH) {
    const identifiers = await catalog.listPartIdentifiers(
      { id: identifierIds.slice(start, start + ID_BATCH) },
      { select: ['part_id'], take: null },
    );
    identifiers.forEach(({ part_id }) => partIds.add(part_id));
  }
  await emitIndexChanges(scope, { partIds });
}
