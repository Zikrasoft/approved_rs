export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { catalogueFromEnv, siteEnv, type CartOutcome } from '@/utils/catalogue';

const id = z.string().trim().min(1).max(100);

const addSchema = z.object({ cart_id: id.nullable(), offer_id: id });
const removeSchema = z.object({ cart_id: id, item_id: id });

const INQUIRY: CartOutcome = { kind: 'inquiry' };

const answer = async <T>(
  input: unknown,
  schema: z.ZodType<T>,
  run: (
    catalogue: NonNullable<ReturnType<typeof catalogueFromEnv>>,
    data: T,
  ) => Promise<CartOutcome>,
): Promise<Response> => {
  const parsed = schema.safeParse(input);
  const catalogue = catalogueFromEnv(siteEnv());
  return Response.json(
    parsed.success && catalogue ? await run(catalogue, parsed.data) : INQUIRY,
  );
};

const body = (request: Request) => request.json().catch(() => null);

export const GET: APIRoute = ({ url }) =>
  answer(url.searchParams.get('id'), id, (catalogue, cartId) =>
    catalogue.viewCart(cartId),
  );

export const POST: APIRoute = async ({ request }) =>
  answer(await body(request), addSchema, (catalogue, data) =>
    catalogue.addToCart(data.cart_id, data.offer_id),
  );

export const DELETE: APIRoute = async ({ request }) =>
  answer(await body(request), removeSchema, (catalogue, data) =>
    catalogue.removeFromCart(data.cart_id, data.item_id),
  );
