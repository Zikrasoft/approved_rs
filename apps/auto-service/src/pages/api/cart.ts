export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  catalogueFromEnv,
  catalogueIdSchema,
  siteEnv,
  type CartOutcome,
} from '@/utils/catalogue';

const addSchema = z.object({
  cart_id: catalogueIdSchema.nullable(),
  offer_id: catalogueIdSchema,
});
const quantitySchema = z.object({
  cart_id: catalogueIdSchema,
  item_id: catalogueIdSchema,
  quantity: z.number().int().positive().max(999),
});
const removeSchema = z.object({
  cart_id: catalogueIdSchema,
  item_id: catalogueIdSchema,
});

const INQUIRY: CartOutcome = { kind: 'inquiry' };

const catalogue = () => catalogueFromEnv(siteEnv());

const respond = async (outcome: Promise<CartOutcome> | undefined) =>
  Response.json((await outcome) ?? INQUIRY);

const body = (request: Request) => request.json().catch(() => null);

export const GET: APIRoute = ({ url }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  return respond(id.success ? catalogue()?.viewCart(id.data) : undefined);
};

export const POST: APIRoute = async ({ request }) => {
  const add = addSchema.safeParse(await body(request));
  return respond(
    add.success
      ? catalogue()?.addToCart(add.data.cart_id, add.data.offer_id)
      : undefined,
  );
};

export const PATCH: APIRoute = async ({ request }) => {
  const change = quantitySchema.safeParse(await body(request));
  return respond(
    change.success
      ? catalogue()?.setQuantity(
          change.data.cart_id,
          change.data.item_id,
          change.data.quantity,
        )
      : undefined,
  );
};

export const DELETE: APIRoute = async ({ request }) => {
  const remove = removeSchema.safeParse(await body(request));
  return respond(
    remove.success
      ? catalogue()?.removeFromCart(remove.data.cart_id, remove.data.item_id)
      : undefined,
  );
};
