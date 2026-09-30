import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import {
  ContainerRegistrationKeys,
  Modules,
  NotificationStatus,
} from '@medusajs/framework/utils';

import { buildOrderEmail } from '../lib/order-email';
import { money, queryOne } from '../lib/query';
import { shopLocale } from '../lib/shop';

type EmailOrder = {
  id: string;
  display_id: number | string;
  email?: string | null;
  locale?: string | null;
  total: unknown;
  items?:
    | ({
        product_title?: string | null;
        title?: string | null;
        quantity: unknown;
        total: unknown;
      } | null)[]
    | null;
};

const TEMPLATE = 'order-placed';
const TRIGGER = 'order.placed';

const EMAIL_FIELDS = [
  'id',
  'display_id',
  'email',
  'locale',
  'total',
  'items.product_title',
  'items.title',
  'items.quantity',
  'items.total',
];

export default async function orderPlacedEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const order = await queryOne<EmailOrder>(query, 'order', EMAIL_FIELDS, {
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
