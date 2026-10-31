export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { previewRequested } from '@/utils/shopPreview';
import { ADDON_KINDS } from '@podbor/catalog-contract/cart-wire';
import { catalogueIdSchema, type CartOutcome } from '@/utils/catalogue';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogueEnv';

export const MAX_LINE_QUANTITY = 999;

const addSchema = z.object({
  cart_id: catalogueIdSchema.nullable(),
  offer_id: catalogueIdSchema,
  quantity: z.number().int().positive().max(MAX_LINE_QUANTITY).default(1),
});

const quantitySchema = z.object({
  cart_id: catalogueIdSchema,
  item_id: catalogueIdSchema,
  quantity: z.number().int().positive(),
});
const addonSchema = z.object({
  cart_id: catalogueIdSchema,
  item_id: catalogueIdSchema,
  addon: z.boolean(),
  kind: z.enum(ADDON_KINDS).default('service'),
});
const removeSchema = z.object({
  cart_id: catalogueIdSchema,
  item_id: catalogueIdSchema,
});

const INQUIRY: CartOutcome = { kind: 'inquiry' };
const EMPTY: CartOutcome = { kind: 'empty' };

const catalogue = (request: Request) =>
  catalogueFromEnv(siteEnv(), {
    preview: previewRequested(request),
  });

const BAD_REQUEST = () =>
  Response.json({ error: 'bad request' }, { status: 400 });

const respond = async (
  outcome: (() => Promise<CartOutcome> | undefined) | null,
) => {
  if (!outcome) return BAD_REQUEST();
  return Response.json((await outcome()) ?? INQUIRY);
};

const body = (request: Request) => request.json().catch(() => null);

export const GET: APIRoute = ({ url, request }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  if (!id.success) return Response.json(EMPTY);
  return respond(() => catalogue(request)?.viewCart(id.data));
};

export const POST: APIRoute = async ({ request }) => {
  const add = addSchema.safeParse(await body(request));
  return respond(
    add.success
      ? () =>
          catalogue(request)?.addToCart(
            add.data.cart_id,
            add.data.offer_id,
            add.data.quantity,
          )
      : null,
  );
};

export const PATCH: APIRoute = async ({ request }) => {
  const change = quantitySchema.safeParse(await body(request));
  if (change.success && change.data.quantity > MAX_LINE_QUANTITY) {
    return Response.json({
      kind: 'refused',
      code: 'OFFER_OUT_OF_STOCK',
      cartId: change.data.cart_id,
    } satisfies CartOutcome);
  }
  return respond(
    change.success
      ? () =>
          catalogue(request)?.setQuantity(
            change.data.cart_id,
            change.data.item_id,
            change.data.quantity,
          )
      : null,
  );
};

export const PUT: APIRoute = async ({ request }) => {
  const change = addonSchema.safeParse(await body(request));
  return respond(
    change.success
      ? () =>
          catalogue(request)?.setAddon(
            change.data.cart_id,
            change.data.item_id,
            change.data.addon,
            change.data.kind,
          )
      : null,
  );
};

export const DELETE: APIRoute = async ({ request }) => {
  const remove = removeSchema.safeParse(await body(request));
  return respond(
    remove.success
      ? () =>
          catalogue(request)?.removeFromCart(
            remove.data.cart_id,
            remove.data.item_id,
          )
      : null,
  );
};
