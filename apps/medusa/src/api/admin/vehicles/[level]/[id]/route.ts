import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { answer } from '../../edit';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  await answer(req, res, 'update');
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  await answer(req, res, 'delete');
}
