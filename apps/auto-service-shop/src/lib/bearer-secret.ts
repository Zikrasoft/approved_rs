import { timingSafeEqual } from 'node:crypto';

import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { parseEnv } from './env';

const matches = (received: string, expected: string) => {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const requireBearer =
  (name: 'SHOP_ORDER_OUTCOME_SECRET' | 'SHOP_LEAD_SECRET') =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
    const expected = parseEnv(process.env)[name];
    const header = req.headers.authorization ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!expected || !matches(bearer, expected)) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    next();
  };

export const requireOrderOutcomeSecret = requireBearer(
  'SHOP_ORDER_OUTCOME_SECRET',
);

export const requireShopLeadSecret = requireBearer('SHOP_LEAD_SECRET');
