import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { startCatalogueRun } from '../../../../../lib/catalogue-writer';
import { supplierAdapters } from '../../../../../lib/suppliers/adapter';
import { importSupplier } from '../../../../../lib/suppliers/import';
import { PUBLISH_MODULE } from '../../../../../modules/publish';
import type PublishModuleService from '../../../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const runs: PublishModuleService = req.scope.resolve(PUBLISH_MODULE);
  const supplier = await suppliers.retrieveSupplier(req.params.id);
  if (!supplier.import_enabled) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `The import of ${supplier.name} is switched off`,
    );
  }
  const adapter = supplierAdapters(req.scope).find(
    ({ name }) => name === supplier.name,
  );
  if (!adapter) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No adapter reads ${supplier.name}`,
    );
  }
  const run = await startCatalogueRun(
    req.scope,
    {
      kind: 'import',
      supplier_id: supplier.id,
      created_by: req.auth_context?.actor_id ?? null,
    },
    (runId) =>
      importSupplier(req.scope, adapter, (progress) =>
        runs.updateCatalogueRuns({
          selector: { id: runId, status: 'running' },
          data: { report: progress },
        }),
      ),
    (report) => ({ report }),
  );
  res.status(202).json({ import_run: run });
}
