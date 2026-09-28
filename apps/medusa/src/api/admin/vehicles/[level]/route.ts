import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { answer } from '../edit';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  await answer(req, res, 'create');
}
