import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import {
  acceptedSecrets,
  bearerToken,
  secretMatches,
} from '@podbor/lead-crm/verify-secret';

import { parseEnv } from './env';

const requireBearer =
  (
    name:
      | 'SHOP_ORDER_OUTCOME_SECRET'
      | 'SHOP_LEAD_SECRET'
      | 'SHOP_EVENTS_SECRET'
      | 'SHOP_VISITOR_SEARCHES_SECRET',
  ) =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
    const accepted = acceptedSecrets(parseEnv(process.env), name);
    if (!secretMatches(bearerToken(req.headers.authorization), accepted)) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    next();
  };

export const requireOrderOutcomeSecret = requireBearer(
  'SHOP_ORDER_OUTCOME_SECRET',
);

export const requireShopLeadSecret = requireBearer('SHOP_LEAD_SECRET');

export const requireShopEventsSecret = requireBearer('SHOP_EVENTS_SECRET');

export const requireVisitorSearchesSecret = requireBearer(
  'SHOP_VISITOR_SEARCHES_SECRET',
);
