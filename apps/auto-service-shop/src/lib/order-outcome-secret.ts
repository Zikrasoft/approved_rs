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

export function requireOrderOutcomeSecret(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
): void {
  const { SHOP_ORDER_OUTCOME_SECRET } = parseEnv(process.env);
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (
    !SHOP_ORDER_OUTCOME_SECRET ||
    !matches(bearer, SHOP_ORDER_OUTCOME_SECRET)
  ) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  next();
}
