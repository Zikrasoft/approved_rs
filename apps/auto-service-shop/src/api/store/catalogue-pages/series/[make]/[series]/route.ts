import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { seriesPageResponseSchema } from '@podbor/catalog-contract';

import { answerCataloguePage } from '../../../../../../lib/catalogue-answer';
import { seriesPageAt } from '../../../../../../lib/series-page';

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  answerCataloguePage(req, res, seriesPageResponseSchema, 'Series', (page) =>
    seriesPageAt(req.scope, req.params.make, req.params.series, page),
  );
