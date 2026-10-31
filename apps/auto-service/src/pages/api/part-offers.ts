export const prerender = false;

import type { APIRoute } from 'astro';
import { catalogueIdSchema } from '@/utils/catalogue';
import type { OffersOutcome } from '@/utils/catalogueWire';
import { catalogueFor, uncachedJson } from '@/utils/catalogueEnv';

const INQUIRY: OffersOutcome = { kind: 'inquiry' };

export const GET: APIRoute = async ({ url, request }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  const outcome = id.success
    ? await catalogueFor(request)?.liveOffers(id.data)
    : undefined;
  return uncachedJson(outcome ?? INQUIRY);
};
