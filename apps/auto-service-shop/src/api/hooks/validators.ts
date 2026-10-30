import { z } from '@medusajs/framework/zod';

export const OrderOutcome = z.strictObject({
  outcome: z.enum(['completed', 'canceled']),
});

export type OrderOutcomeType = z.infer<typeof OrderOutcome>;
