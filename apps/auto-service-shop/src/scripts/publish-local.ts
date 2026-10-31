import type { ExecArgs, ISearchModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../lib/catalogue-writer';
import { parseEnv } from '../lib/env';
import { publishAllNumbers } from '../lib/publish/published';
import { translateCatalogue } from '../lib/publish/translate';
import { CATALOG_MODULE } from '../modules/catalog';

export default async function publishLocal({ container }: ExecArgs) {
  const logger = container.resolve('logger');
  const { OPENAI_API_KEY } = parseEnv(process.env);
  const run = await claimCatalogueWriter(container, {
    kind: 'publish',
    created_by: null,
  });

  await holdCatalogueWriter(container, run.id, async () => {
    if (OPENAI_API_KEY) {
      await translateCatalogue(
        container.resolve(CATALOG_MODULE),
        OPENAI_API_KEY,
      );
      logger.info('Translated the catalogue.');
    } else {
      logger.info('OPENAI_API_KEY is not set, skipped translate.');
    }
    await publishAllNumbers(container);
    await container
      .resolve<ISearchModuleService>(Modules.SEARCH)
      .reindex({ strategy: 'swap' });
  });
  logger.info(
    'Reindexed search. Import and deploy skipped: import from the Suppliers screen, then rebuild the storefront.',
  );
}
