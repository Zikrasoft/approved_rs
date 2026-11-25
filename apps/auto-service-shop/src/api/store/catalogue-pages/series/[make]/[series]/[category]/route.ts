import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { seriesCategoryPageResponseSchema } from '@podbor/catalog-contract';

import { answerCataloguePage } from '../../../../../../../lib/catalogue-answer';
import { seriesCategoryPageAt } from '../../../../../../../lib/series-page';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(
    req,
    res,
    seriesCategoryPageResponseSchema,
    'Series Category',
    (page) =>
      seriesCategoryPageAt(
        req.scope,
        req.params.make,
        req.params.series,
        req.params.category,
        page,
      ),
  );
