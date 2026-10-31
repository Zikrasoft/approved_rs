export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  CART_FINGERPRINT_FIELD,
  checkoutContactSchema,
} from '@podbor/catalog-contract';
import { fitComment } from '@podbor/catalog-contract/comment';
import { waitUntil } from '@vercel/functions';
import { HONEYPOT_FIELD, orderLeadSubmission } from '@podbor/lead-crm';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { plainText } from '@podbor/lead-crm/phone';
import {
  PARTS_ORDER_COPY,
  type NotPlacedReason,
} from '@podbor/lead-crm/parts-order-copy';
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
  refusalReason,
  type CartNotice,
} from '@/utils/cartNotice';
import { PathBuilder } from '@/utils/paths';
import { previewRequested } from '@/utils/shopPreview';

const MAX_CART_LINES_LENGTH = 20_000;

const cartLinesSchema = z
  .string()
  .max(MAX_CART_LINES_LENGTH)
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
  const { notice, reason }: { notice: CartNotice; reason: NotPlacedReason } =
    outcome?.kind === 'refused'
      ? {
          notice: refusalNotice(outcome.code),
          reason: refusalReason(outcome.code),
        }
      : outcome?.kind === 'empty'
        ? { notice: 'expired', reason: 'expired' }
        : { notice: 'unreachable', reason: 'unreachable' };
  const summary = fitComment({
    head: [
      PARTS_ORDER_COPY.notPlaced(PARTS_ORDER_COPY.notPlacedReason[reason]),
    ],
    lines: (cartLinesSchema.parse(form[CART_LINES_FIELD]) ?? '')
      .split('\n')
      .filter(Boolean),
    note: contact.data.comment ?? '',
    limit: MAX_COMMENT_LENGTH,
    more: PARTS_ORDER_COPY.notPlacedLeftOut,
  });
  waitUntil(
    notifyLead(
      orderLeadSubmission(null, { ...contact.data, locale }, summary, locale),
      '[order]',
    ),
  );
  return toCart(notice);
};
