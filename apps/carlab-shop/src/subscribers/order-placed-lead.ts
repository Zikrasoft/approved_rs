import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { parseEnv } from '../lib/env';
import {
  leadOrderSchema,
  orderLeadForm,
  sendOrderLead,
} from '../lib/order-lead';

export default async function orderPlacedLead({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const { LEAD_ROUTE_URL } = parseEnv(process.env);
  if (!LEAD_ROUTE_URL) {
    logger.warn(`Order ${event.data.id}: LEAD_ROUTE_URL is not set`);
    return;
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [row],
  } = await query.graph({
    entity: 'order',
    filters: { id: event.data.id },
    fields: [
      'id',
      'display_id',
      'currency_code',
      'metadata',
      'items.title',
      'items.detail.quantity',
      'items.unit_price',
    ],
  });
  await sendOrderLead(
    LEAD_ROUTE_URL,
    orderLeadForm(leadOrderSchema.parse(row)),
  );
  logger.info(`Order ${event.data.id} handed to the lead pipeline`);
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
