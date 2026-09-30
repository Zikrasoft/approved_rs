import type { APIRoute } from 'astro';
import { shopCatalog } from '@/lib/catalog';
import { catalogVersionText } from '@/lib/catalogVersion';
import { SHOP_STATUS } from '@/utils/shopStatus';

export const GET: APIRoute = async () =>
  new Response(
    await catalogVersionText(SHOP_STATUS, () => shopCatalog().version()),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
