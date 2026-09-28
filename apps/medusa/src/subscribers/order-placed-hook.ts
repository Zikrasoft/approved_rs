import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { parseEnv } from '../lib/env';
import {
  type HookOrder,
  type HookProduct,
  ORDER_HOOK_FIELDS,
  buildOrderHookPayload,
  sendOrderHook,
} from '../lib/order-hook';
import { queryOne } from '../lib/query';

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
  const order = await queryOne<HookOrder>(query, 'order', ORDER_HOOK_FIELDS, {
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
  const { data: products } = await query.graph({
    entity: 'product',
    fields: ['id', 'title', 'type.value'],
    filters: { id: productIds },
  });

  await sendOrderHook(
    buildOrderHookPayload(order, products as HookProduct[], env.ADMIN_URL),
    { url: env.SHOP_ORDER_HOOK_URL, secret: env.SHOP_ORDER_HOOK_SECRET },
  );
  logger.info(`Order ${event.data.id} sent to the order hook`);
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
