import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';

import { readLine } from '../lib/line-metadata';
import { demandModule } from '../lib/part-demand';

export default async function orderPlacedDemand({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const { items } = await container
    .resolve(Modules.ORDER)
    .retrieveOrder(event.data.id, { relations: ['items'] });
  const identifierIds = (items ?? []).flatMap(({ metadata }) => {
    const line = readLine(metadata);
    return line.partIdentifierId && !line.addonKind
      ? [line.partIdentifierId]
      : [];
  });
  await demandModule(container).record({
    signal: 'order',
    identifierIds,
    key: `order:${event.data.id}`,
  });
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
