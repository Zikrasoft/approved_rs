import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { cancelOrderWorkflow } from '@medusajs/medusa/core-flows';
import { z } from 'zod';

import { selectAll } from '../lib/query';
import { moneyField } from '../lib/row-schema';
import { RESERVE_DAYS } from '../lib/shop';

export { RESERVE_DAYS };

export const uncollectedOrderSchema = z.object({
  id: z.string(),
  fulfillments: z.array(
    z.object({ canceled_at: z.union([z.string(), z.date()]).nullish() }),
  ),
  payment_collections: z.array(
    z.object({ captured_amount: moneyField.nullish() }),
  ),
});

type UncollectedOrder = z.infer<typeof uncollectedOrderSchema>;

const isUncollected = (order: UncollectedOrder) =>
  order.fulfillments.every((fulfillment) => Boolean(fulfillment.canceled_at)) &&
  order.payment_collections.every(
    (collection) => (collection.captured_amount ?? 0) === 0,
  );

export default async function releaseUncollected(
  container: MedusaContainer,
): Promise<void> {
  const cutoff = new Date(Date.now() - RESERVE_DAYS * 24 * 60 * 60 * 1000);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orders = await selectAll(
    container.resolve(ContainerRegistrationKeys.QUERY),
    'order',
    uncollectedOrderSchema,
    { status: 'pending', created_at: { $lt: cutoff.toISOString() } },
    {
      skipUnfit: (reason) =>
        logger.error(`Uncollected order skipped: ${reason}`),
    },
  );
  let cancelled = 0;
  for (const order of orders) {
    try {
      if (!isUncollected(order)) continue;
      await cancelOrderWorkflow(container).run({
        input: { order_id: order.id },
      });
      cancelled += 1;
    } catch (error) {
      logger.error(
        `Uncollected order ${order.id} refused cancellation`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  if (orders.length) {
    logger.info(
      `Uncollected orders: ${cancelled} of ${orders.length} cancelled`,
    );
  }
}

export const config = {
  name: 'release-uncollected',
  schedule: '0 * * * *',
};
