import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { createdBy, withEditors } from '../../../lib/editors';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type {
  AdminCreateRequirementType,
  AdminListRequirementsType,
} from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListRequirementsType>,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const requirements = await catalog.listRequirements(
    req.validatedQuery as AdminListRequirementsType,
    {
      relations: ['field', 'field.category'],
      order: { created_at: 'ASC' },
      take: null,
    },
  );

  res.json({ requirements: await withEditors(req.scope, requirements) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateRequirementType>,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const requirement = await catalog.createRequirement({
    ...req.validatedBody,
    ...createdBy(req),
  });

  res.json({ requirement });
}
