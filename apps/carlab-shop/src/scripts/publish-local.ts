import type { ExecArgs, ISearchModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { parseEnv } from '../lib/env';
import { translateCatalogue } from '../lib/publish/translate';
import { importSupplierCatalogues } from '../lib/suppliers/import';
import { CATALOG_MODULE } from '../modules/catalog';

export default async function publishLocal({ container }: ExecArgs) {
  const logger = container.resolve('logger');
  const { OPENAI_API_KEY } = parseEnv(process.env);

  logger.info(
    `Imported: ${JSON.stringify(await importSupplierCatalogues(container))}`,
  );
  if (OPENAI_API_KEY) {
    await translateCatalogue(container.resolve(CATALOG_MODULE), OPENAI_API_KEY);
    logger.info('Translated the catalogue.');
  } else {
    logger.info('OPENAI_API_KEY is not set, skipped translate.');
  }
  await container
    .resolve<ISearchModuleService>(Modules.SEARCH)
    .reindex({ strategy: 'swap' });
  logger.info('Reindexed search. Deploy skipped: rebuild the storefront.');
}
