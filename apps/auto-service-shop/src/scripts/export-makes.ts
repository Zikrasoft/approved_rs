import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ExecArgs } from '@medusajs/framework/types';

import { makeListJson } from '../lib/make-list';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';

const MAKE_LIST = resolve(
  process.cwd(),
  '../auto-service/src/content/makes.json',
);

export default async function exportMakes({ container }: ExecArgs) {
  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const makes = await catalog.listMakes({}, { select: ['slug', 'name'] });
  writeFileSync(MAKE_LIST, makeListJson(makes));
  container
    .resolve('logger')
    .info(`Exported ${makes.length} Makes to ${MAKE_LIST}.`);
}
