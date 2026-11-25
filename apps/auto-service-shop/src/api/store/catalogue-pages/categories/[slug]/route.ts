import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { categoryPageResponseSchema } from '@podbor/catalog-contract';
import { z } from 'zod';

import { answerCataloguePage } from '../../../../../lib/catalogue-answer';
import { categoryPageAt } from '../../../../../lib/category-page';

const pageSchema = z.coerce.number().int().positive().catch(0);

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(
    req,
    res,
    categoryPageResponseSchema,
    'Category',
    (page) => {
      const number = pageSchema.parse(req.query.page ?? 1);
      return number > 0
        ? categoryPageAt(req.scope, req.params.slug, { ...page, page: number })
        : Promise.resolve(null);
    },
  );
