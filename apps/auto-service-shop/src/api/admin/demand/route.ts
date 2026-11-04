import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { demandReport } from '../../../lib/demand-report';
import type { AdminDemandReportType } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminDemandReportType>,
  res: MedusaResponse,
): Promise<void> {
  const { days } = req.validatedQuery as AdminDemandReportType;
  res.json(await demandReport(req.scope, days));
}
