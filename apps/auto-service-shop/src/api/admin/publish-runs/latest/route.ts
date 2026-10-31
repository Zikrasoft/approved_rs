import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { withEditors } from '../../../../lib/editors';
import { latestPublishRun } from '../../../../lib/publish/chain';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const run = await latestPublishRun(req.scope);
  const [started] = run
    ? await withEditors(req.scope, [{ ...run, updated_by: run.created_by }])
    : [];
  res.json({
    publish_run: started
      ? { ...run, created_by_user: started.updated_by_user }
      : null,
  });
}
