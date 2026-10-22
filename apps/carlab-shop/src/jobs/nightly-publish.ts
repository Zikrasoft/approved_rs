import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { startPublishRun } from '../lib/publish/chain';

export default async function nightlyPublish(container: MedusaContainer) {
  await startPublishRun(container, null).catch((error: unknown) =>
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`Nightly publish skipped: ${String(error)}`),
  );
}

export const config = {
  name: 'nightly-publish',
  schedule: '0 3 * * *',
};
