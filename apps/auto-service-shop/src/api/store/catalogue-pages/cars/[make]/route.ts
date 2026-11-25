import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { carMakePageResponseSchema } from '@podbor/catalog-contract';

import { answerCataloguePage } from '../../../../../lib/catalogue-answer';
import { carMakePageAt } from '../../../../../lib/catalogue-cars';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(req, res, carMakePageResponseSchema, 'Car Make', (page) =>
    carMakePageAt(req.scope, req.params.make, page),
  );
