export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogue';

const idSchema = z.string().trim().min(1).max(100);

export const GET: APIRoute = async ({ url }) => {
  const id = idSchema.safeParse(url.searchParams.get('id'));
  const catalogue = catalogueFromEnv(siteEnv());
  return Response.json(
    id.success && catalogue
      ? await catalogue.liveOffers(id.data)
      : { kind: 'inquiry' },
  );
};
