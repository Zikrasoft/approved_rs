import { z } from 'zod';
import {
  contactChannelSchema,
  type LeadSubmission,
  type NotifyLead,
} from '@podbor/lead-crm';
import { MEDUSA_LOCALE, formatPrice } from '@podbor/shop-catalog/browser';
import {
  ORDER_HOOK_HEADER,
  orderHookSchema,
  verifyHook,
  type OrderHookPayload,
} from '@podbor/shop-catalog/order-hook';
import { SHOP_SERVICE } from '@/utils/services';
import type { OrderMarkers } from './orderMarkers';

export const CARD_COMMENT_LIMIT = 2500;

const secretSchema = z.string().trim().min(32);

export function readHookSecret(
  env: Record<string, string | undefined>,
): string | undefined {
  const parsed = secretSchema.safeParse(env.SHOP_ORDER_HOOK_SECRET);
  return parsed.success ? parsed.data : undefined;
}

const escapedLength = (char: string): number =>
  char === '&' ? 5 : char === '<' || char === '>' ? 4 : 1;

function clampForCard(text: string): string {
  const chars = Array.from(text);
  let used = 0;
  for (let i = 0; i < chars.length; i += 1) {
    used += escapedLength(chars[i]);
    if (used > CARD_COMMENT_LIMIT - 1) return `${chars.slice(0, i).join('')}…`;
  }
  return text;
}

export function orderComment(order: OrderHookPayload): string {
  const price = (amount: number) => formatPrice(amount, MEDUSA_LOCALE.ru);
  const sum = order.items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  if (sum !== order.total) {
    console.error('[shop-order] items do not add up', {
      orderId: order.orderId,
      sum,
      total: order.total,
    });
  }
  return clampForCard(
    [
      `Заказ #${order.displayId} · самовывоз · оплата при получении`,
      ...order.items.map(
        (item) =>
          `• ${item.title} × ${item.quantity} — ${price(item.unitPrice * item.quantity)}`,
      ),
      `Итого: ${price(order.total)}`,
      `Email: ${order.customer.email}`,
      ...(order.comment ? [`Комментарий покупателя: ${order.comment}`] : []),
    ].join('\n'),
  );
}

export function orderLead(order: OrderHookPayload): LeadSubmission {
  const channel = contactChannelSchema.safeParse(order.customer.channel);
  return {
    name: order.customer.name,
    contact: order.customer.phone,
    contactChannel: channel.success ? channel.data : null,
    comment: orderComment(order),
    service: SHOP_SERVICE,
    locale: order.locale,
    source_url: order.adminUrl,
    visitorId: null,
    country: null,
    kind: 'lead',
  };
}

export function createShopOrderHandler({
  secret,
  notifyLead,
  markers,
  now = Date.now,
}: {
  secret: string | undefined;
  notifyLead: NotifyLead;
  markers: OrderMarkers;
  now?: () => number;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!secret) {
      console.error('[shop-order] SHOP_ORDER_HOOK_SECRET is not set');
      return Response.json({ error: 'not configured' }, { status: 500 });
    }
    const body = await request.text();
    if (
      !verifyHook(body, request.headers.get(ORDER_HOOK_HEADER), secret, now())
    ) {
      return Response.json({ error: 'bad signature' }, { status: 401 });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return Response.json({ error: 'not json' }, { status: 400 });
    }
    const parsed = orderHookSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        '[shop-order] payload refused',
        z.prettifyError(parsed.error),
      );
      return Response.json({ error: 'bad payload' }, { status: 400 });
    }
    const order = parsed.data;
    try {
      if (await markers.has(order.orderId)) {
        return Response.json({ duplicate: true }, { status: 200 });
      }
    } catch (error) {
      console.error('[shop-order] cannot read the order marker', {
        orderId: order.orderId,
        error,
      });
      return Response.json({ error: 'storage' }, { status: 503 });
    }
    if (!(await notifyLead(orderLead(order), '[shop-order]'))) {
      return Response.json({ delivered: false }, { status: 502 });
    }
    try {
      await markers.add(order.orderId);
    } catch (error) {
      console.error(
        '[shop-order] marker not written — a retry may post the card again',
        { orderId: order.orderId, error },
      );
    }
    return Response.json({ accepted: true }, { status: 202 });
  };
}
