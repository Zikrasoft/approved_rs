import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { orderLeadSync } from '../lib/order-lead-sync';

export default async function orderPlacedLead({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await orderLeadSync(container).placed(event.data.id);
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
