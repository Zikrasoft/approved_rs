import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';

import {
  reindexSupplierOffers,
  SUPPLIER_MARKUP_CHANGED_EVENT,
} from '../lib/suppliers/markup-reindex';

export default async function supplierMarkupReindex({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await reindexSupplierOffers(container, event.data.id);
}

export const config: SubscriberConfig = {
  event: SUPPLIER_MARKUP_CHANGED_EVENT,
};
