import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { categoryPageResponseSchema } from '@podbor/catalog-contract';

import {
  answerCataloguePage,
  requestedPage,
} from '../../../../../lib/catalogue-answer';
import { categoryPageAt } from '../../../../../lib/category-page';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(
    req,
    res,
    categoryPageResponseSchema,
    'Category',
    (page) => {
      const number = requestedPage(req);
      return number > 0
        ? categoryPageAt(req.scope, req.params.slug, { ...page, page: number })
        : Promise.resolve(null);
    },
  );
