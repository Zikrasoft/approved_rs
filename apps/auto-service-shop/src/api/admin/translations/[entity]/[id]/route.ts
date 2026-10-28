import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { withEditors } from '../../../../../lib/editors';
import {
  editTranslation,
  lastEdit,
  readTranslations,
} from '../../../../../lib/publish/translate';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import type { AdminEditTranslationType } from '../../../validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { entity, id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const translations = await readTranslations(catalog, entity, id);
  const [edited] = await withEditors(req.scope, [
    await lastEdit(catalog, entity, id),
  ]);
  res.json({ translations, edited });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminEditTranslationType>,
  res: MedusaResponse,
): Promise<void> {
  const { entity, id } = req.params;
  const { locale, fields } = req.validatedBody;
  res.json({
    translations: await editTranslation(
      req.scope.resolve(CATALOG_MODULE),
      entity,
      id,
      locale,
      fields,
      req.auth_context.actor_id,
    ),
  });
}
