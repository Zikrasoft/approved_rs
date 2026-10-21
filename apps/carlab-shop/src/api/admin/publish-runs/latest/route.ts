import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { latestPublishRun } from '../../../../lib/publish/chain';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({ publish_run: await latestPublishRun(req.scope) });
}
