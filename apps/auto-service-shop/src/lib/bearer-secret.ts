import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { bearerToken, secretMatches } from '@podbor/lead-crm/verify-secret';

import { parseEnv } from './env';

const requireBearer =
  (name: 'SHOP_ORDER_OUTCOME_SECRET' | 'SHOP_LEAD_SECRET') =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
    const env = parseEnv(process.env);
    const accepted = [env[name], env[`${name}_PREVIOUS`]];
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
