import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

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
  const order = await queryOne<EmailOrder>(query, 'order', EMAIL_FIELDS, {
    id: event.data.id,
  });

  if (!order?.email) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(`Order ${event.data.id} has no email, no confirmation sent`);
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

  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: order.email,
    channel: 'email',
    template: 'order-placed',
    content,
    trigger_type: 'order.placed',
    resource_id: order.id,
    resource_type: 'order',
    idempotency_key: `order-placed:${order.id}`,
  });
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
