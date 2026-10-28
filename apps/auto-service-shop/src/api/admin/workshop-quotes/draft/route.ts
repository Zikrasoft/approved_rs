import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { draftQuote, readQuoteUpload } from '../../../../lib/workshop-quote';

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const pdf = await readQuoteUpload(req);
  res.json({ draft: await draftQuote(req.scope, pdf) });
}
