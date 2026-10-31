import type { MedusaRequest } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import { z } from 'zod';

import { parseEnv } from './env';

const previewHeaderSchema = z.literal('1');

const shopOpen = (): boolean => parseEnv(process.env).SHOP_OPEN;

export const pricesShown = (req: Pick<MedusaRequest, 'headers'>): boolean =>
  shopOpen() ||
  previewHeaderSchema.safeParse(req.headers[SHOP_PREVIEW_HEADER]).success;

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
