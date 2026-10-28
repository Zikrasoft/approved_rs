import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { handOrderToLeadRoute } from '../lib/order-lead';

export default async function orderPlacedLead({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await handOrderToLeadRoute(container, event.data.id);
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
