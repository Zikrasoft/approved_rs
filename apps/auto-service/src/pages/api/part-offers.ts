export const prerender = false;

import type { APIRoute } from 'astro';
import { catalogueIdSchema } from '@/utils/catalogue';
import type { OffersOutcome } from '@/utils/catalogueWire';
import {
  catalogueFromEnv,
  siteEnv,
  uncachedJson,
  previewRequested,
} from '@/utils/catalogueEnv';

const INQUIRY: OffersOutcome = { kind: 'inquiry' };

export const GET: APIRoute = async ({ url, request }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  const outcome = id.success
    ? await catalogueFromEnv(siteEnv(), {
        preview: previewRequested(request),
      })?.liveOffers(id.data)
    : undefined;
  return uncachedJson(outcome ?? INQUIRY);
};
