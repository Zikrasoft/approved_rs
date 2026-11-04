import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { orderLeadSync } from '../lib/order-lead-sync';

export default async function orderCanceledLead({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await orderLeadSync(container).canceled(event.data.id);
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
};
