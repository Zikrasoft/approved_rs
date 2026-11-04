import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { adminFitmentSchema } from '../../../../lib/store-response';
import { parseAdminBody } from '../../../../lib/admin-errors';
import {
  type AdminUpdateFitmentType,
  StoredFitmentPeriod,
} from '../../validators';
import { updatedBy } from '../../../../lib/editors';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateFitmentType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const changes = req.validatedBody;
  await parseAdminBody(StoredFitmentPeriod, {
    ...(await catalog.retrieveFitment(id)),
    ...changes,
  });
  await catalog.updateFitments({
    ...changes,
    id,
    ...updatedBy(req),
  });

  res.json({
    fitment: adminFitmentSchema.parse(await catalog.retrieveFitment(id)),
  });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveFitment(id);
  await catalog.softDeleteFitments(id);

  res.json({ id, object: 'fitment', deleted: true });
}
