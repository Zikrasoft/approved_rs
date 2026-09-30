import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { cancelOrderWorkflow } from '@medusajs/medusa/core-flows';

import { money, queryAll } from '../lib/query';
import { RESERVE_DAYS } from '../lib/shop';

type UncollectedOrder = {
  id: string;
  fulfillments?: ({ canceled_at?: string | Date | null } | null)[] | null;
  payment_collections?: ({ captured_amount?: unknown } | null)[] | null;
};

const ORDER_FIELDS = [
  'id',
  'fulfillments.canceled_at',
  'payment_collections.captured_amount',
];

const isUncollected = (order: UncollectedOrder) =>
  (order.fulfillments ?? []).every(
    (fulfillment) => !fulfillment || Boolean(fulfillment.canceled_at),
  ) &&
  (order.payment_collections ?? []).every(
    (collection) => money(collection?.captured_amount ?? 0) === 0,
  );

export default async function releaseUncollected(
  container: MedusaContainer,
): Promise<void> {
  const cutoff = new Date(Date.now() - RESERVE_DAYS * 24 * 60 * 60 * 1000);
  const orders = await queryAll<UncollectedOrder>(
    container.resolve(ContainerRegistrationKeys.QUERY),
    'order',
    ORDER_FIELDS,
    { status: 'pending', created_at: { $lt: cutoff.toISOString() } },
  );
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  let cancelled = 0;
  for (const order of orders.filter(isUncollected)) {
    try {
      await cancelOrderWorkflow(container).run({
        input: { order_id: order.id },
      });
      cancelled += 1;
    } catch (error) {
      logger.error(
        `Uncollected order ${order.id} refused cancellation`,
        error as Error,
      );
    }
  }
  if (cancelled) {
    logger.info(`Uncollected orders: ${cancelled} order(s) cancelled`);
  }
}

export const config = {
  name: 'release-uncollected',
  schedule: '0 * * * *',
};
