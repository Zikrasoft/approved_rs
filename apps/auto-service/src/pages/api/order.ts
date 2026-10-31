export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  CART_FINGERPRINT_FIELD,
  checkoutContactSchema,
} from '@podbor/catalog-contract';
import { waitUntil } from '@vercel/functions';
import { HONEYPOT_FIELD, orderLeadSubmission } from '@podbor/lead-crm';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { plainText } from '@podbor/lead-crm/phone';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import { notifyLead } from '@/lib/crm';
import { localeFieldSchema } from '@/i18n/localeField';
import { catalogueIdSchema } from '@/utils/catalogue';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogueEnv';
import {
  CART_LINES_FIELD,
  CART_NOTICE_PARAM,
  ORDER_NUMBER_PARAM,
  ORDERED_CART_PARAM,
  refusalNotice,
  type CartNotice,
} from '@/utils/cartNotice';
import { PathBuilder } from '@/utils/paths';
import { previewRequested } from '@/utils/shopPreview';

const cartLinesSchema = z
  .string()
  .max(MAX_COMMENT_LENGTH)
  .transform(plainText)
  .optional()
  .catch(undefined);

const orderSchema = z.object({
  cart_id: catalogueIdSchema,
  consent: z.string().min(1),
  [CART_FINGERPRINT_FIELD]: z.string().min(1).max(10_000),
});

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = Object.fromEntries(
    await request.formData().catch(() => new FormData()),
  );
  const locale = localeFieldSchema.parse(form.locale);
  const toCart = (notice: CartNotice, extra: Record<string, string> = {}) =>
    redirect(
      `${PathBuilder.partsCart(locale)}?${new URLSearchParams({ [CART_NOTICE_PARAM]: notice, ...extra })}`,
      303,
    );

  if (form[HONEYPOT_FIELD]) {
    return toCart('ordered');
  }
  const order = orderSchema.safeParse(form);
  const contact = checkoutContactSchema.safeParse({ ...form, locale });
  if (!order.success || !contact.success) {
    return toCart('invalid');
  }
  const outcome = await catalogueFromEnv(siteEnv(), {
    preview: previewRequested(request),
  })?.placeOrder(
    order.data.cart_id,
    contact.data,
    order.data[CART_FINGERPRINT_FIELD],
  );
  if (outcome?.kind === 'order') {
    return toCart('ordered', {
      [ORDER_NUMBER_PARAM]: String(outcome.order.display_id),
      [ORDERED_CART_PARAM]: order.data.cart_id,
    });
  }
  const notice =
    outcome?.kind === 'refused'
      ? refusalNotice(outcome.code)
      : outcome?.kind === 'empty'
        ? 'expired'
        : 'unreachable';
  const summary = [
    PARTS_ORDER_COPY.notPlaced(PARTS_ORDER_COPY.notPlacedReason[notice]),
    cartLinesSchema.parse(form[CART_LINES_FIELD]),
    contact.data.comment,
  ]
    .filter(Boolean)
    .join('\n');
  waitUntil(
    notifyLead(
      orderLeadSubmission(null, contact.data, summary, locale),
      '[order]',
    ),
  );
  return toCart(notice);
};
