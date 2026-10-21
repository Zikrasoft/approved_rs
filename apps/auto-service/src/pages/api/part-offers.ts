export const prerender = false;

import type { APIRoute } from 'astro';
import {
  catalogueFromEnv,
  catalogueIdSchema,
  siteEnv,
  type OffersOutcome,
} from '@/utils/catalogue';

const INQUIRY: OffersOutcome = { kind: 'inquiry' };

export const GET: APIRoute = async ({ url }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  const outcome = id.success
    ? await catalogueFromEnv(siteEnv())?.liveOffers(id.data)
    : undefined;
  return Response.json(outcome ?? INQUIRY);
};
