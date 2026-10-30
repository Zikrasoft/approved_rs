import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { handCancelToLeadRoute } from '../lib/order-lead';

export default async function orderCanceledLead({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await handCancelToLeadRoute(container, event.data.id);
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
};
