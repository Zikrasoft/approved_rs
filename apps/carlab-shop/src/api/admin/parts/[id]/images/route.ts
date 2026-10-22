import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  readImageUpload,
  readPartImages,
  storeImage,
  writePartImages,
} from '../../../../../lib/images';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const actor = req.auth_context.actor_id;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const current = await readPartImages(catalog, id);
  const body = await readImageUpload(req);
  const image = await storeImage(req.scope, body, `parts/${id}`, actor);

  res.json(await writePartImages(catalog, id, [...current, image], actor));
}
