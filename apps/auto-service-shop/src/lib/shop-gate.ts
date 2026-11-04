import type { MedusaRequest } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import { secretMatches } from '@podbor/lead-crm/verify-secret';
import { z } from 'zod';

import { parseEnv } from './env';

const previewHeaderSchema = z.string().catch('');

export const pricesShown = (req: Pick<MedusaRequest, 'headers'>): boolean => {
  const { SHOP_OPEN, SHOP_PREVIEW_TOKEN } = parseEnv(process.env);
  return (
    SHOP_OPEN ||
    secretMatches(
      previewHeaderSchema.parse(req.headers[SHOP_PREVIEW_HEADER]),
      SHOP_PREVIEW_TOKEN,
    )
  );
};

export const refuseClosedShop = (
  req: MedusaRequest,
  _res: unknown,
  next: (error?: MedusaError) => void,
): void =>
  pricesShown(req)
    ? next()
    : next(
        new MedusaError(
          MedusaError.Types.FORBIDDEN,
          'The shop sells only to preview visitors while it is closed',
        ),
      );
