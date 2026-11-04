import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  deleteManualOffer,
  type ManualOffer,
  saveManualOffer,
} from '../../../../../lib/suppliers/manual-offers';

export async function POST(
  req: AuthenticatedMedusaRequest<ManualOffer>,
  res: MedusaResponse,
): Promise<void> {
  const offer = await saveManualOffer(
    req.scope,
    req.params.id,
    req.validatedBody,
    req.auth_context.actor_id,
  );
  res.json({ offer: { id: offer.id } });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  await deleteManualOffer(req.scope, req.params.id);
  res.json({ object: 'manual_offer', deleted: true });
}
