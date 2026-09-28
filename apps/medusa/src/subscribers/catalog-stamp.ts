import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import {
  CATALOG_EVENTS,
  CATALOG_VERSION_KEY,
  nextCatalogVersion,
} from '../lib/catalog-version';
import { parseEnv } from '../lib/env';
import { updateStoreMetadata } from '../lib/metadata';
import {
  type RebuildScheduler,
  createRebuildScheduler,
  dispatchTarget,
} from '../lib/rebuild';

let scheduler: RebuildScheduler | undefined;

export default async function catalogStamp({
  event,
  container,
}: SubscriberArgs<unknown>) {
  await updateStoreMetadata(container, {
    [CATALOG_VERSION_KEY]: nextCatalogVersion(),
  });

  const env = parseEnv(process.env);
  scheduler ??= createRebuildScheduler({
    target: dispatchTarget(env),
    configured: env.REBUILD_ON_CATALOG_EVENTS,
    debounceMs: env.REBUILD_DEBOUNCE_MS,
    logger: container.resolve(ContainerRegistrationKeys.LOGGER),
  });
  scheduler.schedule(event.name);
}

export const config: SubscriberConfig = {
  event: [...CATALOG_EVENTS],
};
