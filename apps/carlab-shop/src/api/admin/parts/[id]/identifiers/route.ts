import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { adminPart } from '../../../../../lib/admin-part';
import type { AdminAddPartIdentifierType } from '../../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminAddPartIdentifierType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.addPartIdentifier(id, req.validatedBody, {
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ part: await adminPart(catalog, id) });
}
