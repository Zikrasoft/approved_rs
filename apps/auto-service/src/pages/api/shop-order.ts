export const prerender = false;

import type { APIRoute } from 'astro';
import { notifyLead } from '@/lib/crmBot';
import { orderMarkers } from '@/lib/orderMarkers';
import { createShopOrderHandler, readHookSecret } from '@/lib/shopOrder';

const handle = createShopOrderHandler({
  secret: readHookSecret(process.env),
  notifyLead,
  markers: orderMarkers,
});

export const POST: APIRoute = ({ request }) => handle(request);
