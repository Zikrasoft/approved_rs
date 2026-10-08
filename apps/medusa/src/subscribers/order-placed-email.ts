import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import {
  ContainerRegistrationKeys,
  Modules,
  NotificationStatus,
} from '@medusajs/framework/utils';
import { z } from 'zod';

import { buildOrderEmail } from '../lib/order-email';
import { money } from '../lib/money';
import { selectOne } from '../lib/query';
import { shopLocale } from '../lib/shop';

const nullableText = z.string().nullish();

export const emailOrderSchema = z.object({
  id: z.string(),
  display_id: z.union([z.number(), z.string()]),
  email: nullableText,
  locale: nullableText,
  total: z.unknown(),
  items: z
    .array(
      z
        .object({
          product_title: nullableText,
          title: nullableText,
          quantity: z.unknown(),
          total: z.unknown(),
        })
        .nullable(),
    )
    .nullish(),
});

const TEMPLATE = 'order-placed';
const TRIGGER = 'order.placed';

export default async function orderPlacedEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const order = await selectOne(query, 'order', emailOrderSchema, {
    id: event.data.id,
  });
  if (!order) {
    throw new Error(`Order ${event.data.id} not found`);
  }
  if (!order.email) {
    logger.info(`Order ${order.id} has no email, no confirmation sent`);
    return;
  }

  const notifications = container.resolve(Modules.NOTIFICATION);
  const earlier = await notifications.listNotifications(
    { resource_id: order.id, template: TEMPLATE, trigger_type: TRIGGER },
    { select: ['status'] },
  );
  if (earlier.some((sent) => sent.status !== NotificationStatus.FAILURE)) {
    logger.info(`Order ${order.id} already has a confirmation, not sent again`);
    return;
  }

  const content = buildOrderEmail({
    displayId: Number(order.display_id),
    locale: shopLocale(order.locale),
    items: (order.items ?? []).flatMap((item) =>
      item
        ? [
            {
              title: item.product_title ?? item.title ?? '',
              quantity: money(item.quantity),
              total: money(item.total),
            },
          ]
        : [],
    ),
    total: money(order.total),
  });

  await notifications.createNotifications({
    to: order.email,
    channel: 'email',
    template: TEMPLATE,
    content,
    trigger_type: TRIGGER,
    resource_id: order.id,
    resource_type: 'order',
    idempotency_key: earlier.length
      ? `order-placed:${order.id}:${earlier.length + 1}`
      : `order-placed:${order.id}`,
  });
}

export const config: SubscriberConfig = {
  event: TRIGGER,
};
