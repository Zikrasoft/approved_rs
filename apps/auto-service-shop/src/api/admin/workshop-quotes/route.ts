import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { createdBy } from '../../../lib/editors';
import { confirmQuote } from '../../../lib/workshop-quote';
import type { AdminConfirmWorkshopQuoteType } from '../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfirmWorkshopQuoteType>,
  res: MedusaResponse,
): Promise<void> {
  res.json({
    confirmed: await confirmQuote(req.scope, req.validatedBody, createdBy(req)),
  });
}
