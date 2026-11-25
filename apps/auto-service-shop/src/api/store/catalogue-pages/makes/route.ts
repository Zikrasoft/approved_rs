import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { makesPageResponseSchema } from '@podbor/catalog-contract';

import { answerCataloguePage } from '../../../../lib/catalogue-answer';
import { makesPage } from '../../../../lib/catalogue-makes';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(req, res, makesPageResponseSchema, 'Makes', (page) =>
    makesPage(req.scope),
  );
