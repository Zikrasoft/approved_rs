import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { makePageResponseSchema } from '@podbor/catalog-contract';

import { answerCataloguePage } from '../../../../../lib/catalogue-answer';
import { makePageAt } from '../../../../../lib/catalogue-makes';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(req, res, makePageResponseSchema, 'Make', (page) =>
    makePageAt(req.scope, req.params.slug, page),
  );
