import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partPageResponseSchema } from '@podbor/catalog-contract';

import { answerCataloguePage } from '../../../../../lib/catalogue-answer';
import { partPageAt } from '../../../../../lib/part-page';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(req, res, partPageResponseSchema, 'Part', (page) =>
    partPageAt(req.scope, req.params.slug, page),
  );
