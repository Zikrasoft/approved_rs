export const prerender = false;

import type { APIRoute } from 'astro';
import {
  catalogueFromEnv,
  catalogueIdSchema,
  siteEnv,
  type OffersOutcome,
} from '@/utils/catalogue';
import { previewRequested } from '@/scripts/shopPreview';

const INQUIRY: OffersOutcome = { kind: 'inquiry' };

export const GET: APIRoute = async ({ url, request }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  const outcome = id.success
    ? await catalogueFromEnv(siteEnv(), {
        preview: previewRequested(request),
      })?.liveOffers(id.data)
    : undefined;
  return Response.json(outcome ?? INQUIRY);
};
