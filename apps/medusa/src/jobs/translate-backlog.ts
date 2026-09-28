import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { parseEnv } from '../lib/env';
import { queryAll } from '../lib/query';
import {
  SOURCE_ROW_FIELDS,
  type SourceRow,
  isCurrent,
  translateProduct,
} from '../lib/translate-product';

export const BACKLOG_BATCH = 50;

export default async function translateBacklog(
  container: MedusaContainer,
): Promise<void> {
  if (!parseEnv(process.env).OPENAI_API_KEY) {
    return;
  }
  const products = await queryAll<SourceRow>(
    container.resolve(ContainerRegistrationKeys.QUERY),
    'product',
    SOURCE_ROW_FIELDS,
  );
  const stale = products
    .filter((product) => !isCurrent(product))
    .slice(0, BACKLOG_BATCH);
  for (const product of stale) {
    await translateProduct(container, product.id);
  }
  if (stale.length) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(`Translation backlog: ${stale.length} product(s) retried`);
  }
}

export const config = {
  name: 'translate-backlog',
  schedule: '0 * * * *',
};
