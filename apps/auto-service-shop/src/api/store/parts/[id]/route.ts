import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { pricesShown } from '../../../../lib/offer-cart';
import {
  PART_WITH_OFFERS_FIELDS,
  toPartResponse,
} from '../../../../lib/store-response';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [part],
  } = await query.graph(
    {
      entity: 'part',
      fields: PART_WITH_OFFERS_FIELDS,
      filters: { id: req.params.id },
    },
    { throwIfKeyNotFound: true },
  );
  const response = toPartResponse(part);

  res.json({
    part: pricesShown(req)
      ? response
      : {
          ...response,
          identifiers: response.identifiers.map((identifier) => ({
            ...identifier,
            offers: [],
          })),
        },
  });
}
