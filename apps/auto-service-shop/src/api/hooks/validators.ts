import { z } from '@medusajs/framework/zod';
import { ORDER_OUTCOMES } from '@podbor/lead-crm/shop-orders-wire';

export const OrderOutcome = z.strictObject({
  outcome: z.enum(ORDER_OUTCOMES),
});

export type OrderOutcomeType = z.infer<typeof OrderOutcome>;
