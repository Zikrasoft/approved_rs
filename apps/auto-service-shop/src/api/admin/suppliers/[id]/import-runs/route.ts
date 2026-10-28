import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { importRunsOf } from '../../../../../lib/catalogue-writer';

const REPORTS_SHOWN = 20;

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({
    import_runs: await importRunsOf(req.scope, req.params.id, REPORTS_SHOWN),
  });
}
