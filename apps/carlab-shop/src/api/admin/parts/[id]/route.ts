import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import type { AdminUpdatePartType } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdatePartType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.replacePart(
    id,
    req.validatedBody.replaced_by_id,
    req.auth_context.actor_id,
  );

  const { name, replaced_by_id, updated_by } = await catalog.retrievePart(id);
  res.json({ part: { id, name, replaced_by_id, updated_by } });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const supplier: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);

  const part = await catalog.retrievePart(id, { relations: ['identifiers'] });

  await catalog.deleteParts(id);
  await supplier.deleteSupplierOffers({
    part_identifier_id: part.identifiers.map((identifier) => identifier.id),
  });

  res.json({ id, object: 'part', deleted: true });
}
