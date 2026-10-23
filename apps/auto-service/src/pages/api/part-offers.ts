export const prerender = false;

import type { APIRoute } from 'astro';
import {
  catalogueFromEnv,
  catalogueIdSchema,
  previewRequested,
  siteEnv,
  type OffersOutcome,
} from '@/utils/catalogue';
import { SHOP_PREVIEW_HEADER } from '@/scripts/shopPreview';

const INQUIRY: OffersOutcome = { kind: 'inquiry' };

export const GET: APIRoute = async ({ url, request }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  const outcome = id.success
    ? await catalogueFromEnv(siteEnv(), {
        preview: previewRequested(request.headers.get(SHOP_PREVIEW_HEADER)),
      })?.liveOffers(id.data)
    : undefined;
  return Response.json(outcome ?? INQUIRY);
};
