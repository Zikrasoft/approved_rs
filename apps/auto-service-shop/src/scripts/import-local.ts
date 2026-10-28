import type { ExecArgs } from '@medusajs/framework/types';

import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../lib/catalogue-writer';
import { importSupplierCatalogues } from '../lib/suppliers/import';

export default async function importLocal({ container }: ExecArgs) {
  const run = await claimCatalogueWriter(container, {
    kind: 'import',
    created_by: null,
  });
  const imports = await holdCatalogueWriter(
    container,
    run.id,
    () => importSupplierCatalogues(container),
    (summaries) => ({ report: { imports: summaries } }),
  );
  container.resolve('logger').info(`Imported: ${JSON.stringify(imports)}`);
}
