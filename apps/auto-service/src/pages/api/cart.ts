export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { readJson } from '@podbor/lead-crm';
import {
  ADDON_KINDS,
  MAX_LINE_QUANTITY,
} from '@podbor/catalog-contract/cart-wire';
import { catalogueIdSchema } from '@/utils/catalogue';
import type { CartOutcome } from '@/utils/catalogueWire';
import { catalogueFor, uncachedJson } from '@/utils/catalogueEnv';
import { reportShopEvent, type ShopEvent } from '@/lib/shopEvents';

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
  on: z.boolean(),
  kind: z.enum(ADDON_KINDS),
});
const removeSchema = z.object({
  cart_id: catalogueIdSchema,
  item_id: catalogueIdSchema,
});

const INQUIRY: CartOutcome = { kind: 'inquiry' };
const EMPTY: CartOutcome = { kind: 'empty' };

type CartAction = Extract<ShopEvent, { event: 'storefront.cart' }>['action'];

const report = (
  request: Request,
  action: CartAction,
  outcome: string,
  reason: string | null = null,
) =>
  reportShopEvent(request, {
    event: 'storefront.cart',
    action,
    outcome,
    reason,
  });

const respond = async (
  request: Request,
  action: CartAction,
  outcome: (() => Promise<CartOutcome> | undefined) | null,
) => {
  if (!outcome) {
    report(request, action, 'invalid');
    return uncachedJson({ error: 'bad request' }, { status: 400 });
  }
  const answer = (await outcome()) ?? INQUIRY;
  report(
    request,
    action,
    answer.kind,
    answer.kind === 'refused' ? answer.code : null,
  );
  return uncachedJson(answer);
};

const withJson = async (
  request: Request,
  handle: (json: unknown) => Promise<Response>,
): Promise<Response> => {
  const read = await readJson(request);
  return 'response' in read ? read.response : handle(read.value);
};

export const GET: APIRoute = ({ url, request }) => {
  const id = catalogueIdSchema.safeParse(url.searchParams.get('id'));
  if (!id.success) return uncachedJson(EMPTY);
  return respond(request, 'view', () =>
    catalogueFor(request)?.viewCart(id.data),
  );
};

export const POST: APIRoute = ({ request }) =>
  withJson(request, async (json) => {
    const add = addSchema.safeParse(json);
    return respond(
      request,
      'add',
      add.success
        ? () =>
            catalogueFor(request)?.addToCart(
              add.data.cart_id,
              add.data.offer_id,
              add.data.quantity,
            )
        : null,
    );
  });

export const PATCH: APIRoute = ({ request }) =>
  withJson(request, async (json) => {
    const change = quantitySchema.safeParse(json);
    if (change.success && change.data.quantity > MAX_LINE_QUANTITY) {
      report(request, 'quantity', 'refused', 'OFFER_OUT_OF_STOCK');
      return uncachedJson({
        kind: 'refused',
        code: 'OFFER_OUT_OF_STOCK',
        cartId: change.data.cart_id,
      } satisfies CartOutcome);
    }
    return respond(
      request,
      'quantity',
      change.success
        ? () =>
            catalogueFor(request)?.setQuantity(
              change.data.cart_id,
              change.data.item_id,
              change.data.quantity,
            )
        : null,
    );
  });

export const PUT: APIRoute = ({ request }) =>
  withJson(request, async (json) => {
    const change = addonSchema.safeParse(json);
    return respond(
      request,
      'addon',
      change.success
        ? () =>
            catalogueFor(request)?.setAddon(
              change.data.cart_id,
              change.data.item_id,
              change.data.on,
              change.data.kind,
            )
        : null,
    );
  });

export const DELETE: APIRoute = ({ request }) =>
  withJson(request, async (json) => {
    const remove = removeSchema.safeParse(json);
    return respond(
      request,
      'remove',
      remove.success
        ? () =>
            catalogueFor(request)?.removeFromCart(
              remove.data.cart_id,
              remove.data.item_id,
            )
        : null,
    );
  });
