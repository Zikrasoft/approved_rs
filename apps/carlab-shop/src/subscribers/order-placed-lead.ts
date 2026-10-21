import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

import { parseEnv } from '../lib/env';
import {
  LEAD_HANDOFF_ERROR,
  leadOrderSchema,
  orderLeadForm,
  sendOrderLead,
} from '../lib/order-lead';

async function handOff(container: MedusaContainer, id: string): Promise<void> {
  const { LEAD_ROUTE_URL } = parseEnv(process.env);
  if (!LEAD_ROUTE_URL) {
    throw new Error('LEAD_ROUTE_URL is not set');
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [row],
  } = await query.graph({
    entity: 'order',
    filters: { id },
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
}

async function recordFailure(
  container: MedusaContainer,
  id: string,
  reason: string,
): Promise<void> {
  const orders = container.resolve(Modules.ORDER);
  const order = await orders.retrieveOrder(id);
  await orders.updateOrders(id, {
    metadata: { ...order.metadata, [LEAD_HANDOFF_ERROR]: reason },
  });
}

export default async function orderPlacedLead({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const { id } = event.data;
  try {
    await handOff(container, id);
    logger.info(`Order ${id} handed to the lead pipeline`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(`Order ${id} did not reach the lead pipeline: ${reason}`);
    await recordFailure(container, id, reason);
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
