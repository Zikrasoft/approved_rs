export const prerender = false;

import type { APIRoute } from 'astro';
import { catalogueIdSchema, type OffersOutcome } from '@/utils/catalogue';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogueEnv';
import { previewRequested } from '@/utils/shopPreview';

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
