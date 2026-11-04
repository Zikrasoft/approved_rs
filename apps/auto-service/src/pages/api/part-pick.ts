export const prerender = false;

import type { APIRoute } from 'astro';
import { reportDemand } from '@/lib/shopEvents';

const MAX_PICK_BYTES = 256;

export const POST: APIRoute = async ({ request }) => {
  const slug = (await request.text()).slice(0, MAX_PICK_BYTES).trim();
  reportDemand(request, 'pick', [slug]);
  return new Response(null, { status: 204 });
};
