import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { seriesCategoryPageResponseSchema } from '@podbor/catalog-contract';

import {
  answerCataloguePage,
  requestedPage,
} from '../../../../../../../lib/catalogue-answer';
import { seriesCategoryPageAt } from '../../../../../../../lib/series-page';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(
    req,
    res,
    seriesCategoryPageResponseSchema,
    'Series Category',
    (page) => {
      const number = requestedPage(req);
      return number > 0
        ? seriesCategoryPageAt(
            req.scope,
            req.params.make,
            req.params.series,
            req.params.category,
            page,
            number,
          )
        : Promise.resolve(null);
    },
  );
