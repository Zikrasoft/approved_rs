import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import {
  adSourceFieldSchema,
  metaIdsFieldSchema,
  siteUrl,
  vinNote,
  visitorIdSchema,
} from '../form.ts';
import {
  LEAD_MISSING,
  LEAD_WON,
  shopOrderEventSchema,
  type OrderContact,
} from '../shopOrdersWire.ts';
import { bearerToken, secretMatches } from '../verifySecret.ts';
import type { NotifyLead } from '../notifyLead.ts';
import type { CancelOrderResult } from '../brandBot.ts';
import type { LeadSubmission } from '../schema.ts';

const CANCEL_STATUS: Record<CancelOrderResult, number> = {
  lost: 204,
  won: LEAD_WON,
  missing: LEAD_MISSING,
};

export interface ShopOrdersRouteOptions {
  secret: string | undefined;
  notifyLead: NotifyLead;
  cancelOrder: (orderId: string) => Promise<CancelOrderResult>;
  isLocale: (value: string) => boolean;
  defaultLocale: string;
}

export const orderLeadSubmission = (
  orderId: string | null,
  contact: OrderContact,
  summary: string,
  locale: string,
  origin: string,
): LeadSubmission => ({
  name: contact.name ?? '',
  contact: contact.contact,
  contactChannel: contact.contact_channel ?? null,
  service: PARTS_ORDER_SERVICE,
  services: [PARTS_ORDER_SERVICE],
  comment: [contact.vin && vinNote(contact.vin), summary]
    .filter(Boolean)
    .join('\n'),
  country: null,
  source_url: siteUrl(contact.source_url, origin),
  visitorId: visitorIdSchema.parse(contact.visitor_id),
  adSource: adSourceFieldSchema.parse(contact.ad_source),
  metaIds: metaIdsFieldSchema.parse(contact.meta_ids),
  orderId,
  locale,
});

export function createShopOrdersRoute({
  secret,
  notifyLead,
  cancelOrder,
  isLocale,
  defaultLocale,
}: ShopOrdersRouteOptions) {
  return async function POST({
    request,
  }: {
    request: Request;
  }): Promise<Response> {
    if (
      !secretMatches(bearerToken(request.headers.get('authorization')), secret)
    )
      return new Response(null, { status: 401 });
    const event = shopOrderEventSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!event.success) return new Response(null, { status: 400 });
    if (event.data.event === 'canceled')
      return new Response(null, {
        status: CANCEL_STATUS[await cancelOrder(event.data.order_id)],
      });
    const { order_id, contact, summary } = event.data;
    const locale =
      contact.locale && isLocale(contact.locale)
        ? contact.locale
        : defaultLocale;
    const { stored, delivered } = await notifyLead(
      orderLeadSubmission(
        order_id,
        contact,
        summary,
        locale,
        new URL(request.url).origin,
      ),
      '[shop-orders]',
    );
    return new Response(null, { status: stored || delivered ? 201 : 503 });
  };
}
