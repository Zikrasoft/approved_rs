import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { startPublishRun } from '../../../lib/publish/chain';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const publishRun = await startPublishRun(
    req.scope,
    req.auth_context?.actor_id ?? null,
  );
  res.status(202).json({ publish_run: publishRun });
}
