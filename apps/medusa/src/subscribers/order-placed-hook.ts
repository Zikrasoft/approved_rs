import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { OrderHookPayload } from '@podbor/shop-catalog/order-hook';
import { z } from 'zod';

import { parseEnv } from '../lib/env';
import {
  buildOrderHookPayload,
  hookOrderSchema,
  hookProductSchema,
  sendOrderHook,
} from '../lib/order-hook';
import { selectAll, selectOne } from '../lib/query';

export default async function orderPlacedHook({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const env = parseEnv(process.env);
  if (!env.SHOP_ORDER_HOOK_URL || !env.SHOP_ORDER_HOOK_SECRET) {
    logger.warn(
      `Order ${event.data.id}: SHOP_ORDER_HOOK_URL is not set, no card is sent`,
    );
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const order = await selectOne(query, 'order', hookOrderSchema, {
    id: event.data.id,
  });
  if (!order) {
    throw new Error(`Order ${event.data.id} not found`);
  }

  const productIds = [
    ...new Set(
      (order.items ?? []).flatMap((item) =>
        item?.product_id ? [item.product_id] : [],
      ),
    ),
  ];
  const products = await selectAll(query, 'product', hookProductSchema, {
    id: productIds,
  });

  let payload: OrderHookPayload;
  try {
    payload = buildOrderHookPayload(order, products, env.ADMIN_URL);
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      throw error;
    }
    const fields = error.issues.map((issue) => issue.path.join('.'));
    logger.error(
      `Order ${order.id} does not fit the order card, not sent: ${fields.join(', ')}`,
    );
    return;
  }

  await sendOrderHook(payload, {
    url: env.SHOP_ORDER_HOOK_URL,
    secret: env.SHOP_ORDER_HOOK_SECRET,
  });
  logger.info(`Order ${event.data.id} sent to the order hook`);
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
