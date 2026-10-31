import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { BRANDS, deleteUnlessHeld } from '../../vehicle-reference-routes';

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  await deleteUnlessHeld(req, BRANDS, id);
  res.json({ id, object: 'brand', deleted: true });
}
