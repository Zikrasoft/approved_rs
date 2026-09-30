import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import { translateProduct } from '../lib/translate-product';

export default async function translateProductSubscriber({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await translateProduct(container, event.data.id);
}

export const config: SubscriberConfig = {
  event: ['product.created', 'product.updated'],
};
