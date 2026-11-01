export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  CART_FINGERPRINT_FIELD,
  checkoutContactSchema,
} from '@podbor/catalog-contract';
import { fitComment } from '@podbor/catalog-contract/comment';
import { waitUntil } from '@vercel/functions';
import {
  readForm,
  HONEYPOT_FIELD,
  orderLeadSubmission,
} from '@podbor/lead-crm';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import { plainText } from '@podbor/lead-crm/phone';
import {
  PARTS_ORDER_COPY,
  type NotPlacedReason,
} from '@podbor/lead-crm/parts-order-copy';
import { BRAND, leadStore, notifyLead } from '@/lib/crm';
import { reportShopEvent, type ShopEvent } from '@/lib/shopEvents';
import { localeFieldSchema } from '@/i18n/localeField';
import { catalogueIdSchema } from '@/utils/catalogue';
import { catalogueFor } from '@/utils/catalogueEnv';
import {
  CART_LINES_FIELD,
  CART_NOTICE_PARAM,
  ORDER_NUMBER_PARAM,
  ORDERED_CART_PARAM,
  refusalNotice,
  type CartNotice,
} from '@/utils/cartNotice';
import { PathBuilder } from '@/utils/paths';

const MAX_CART_LINES_LENGTH = 20_000;

const cartLinesSchema = z
  .string()
  .max(MAX_CART_LINES_LENGTH)
  .transform((text) => plainText(text).replace(/\r\n?/g, '\n'))
  .optional()
  .catch(undefined);

const orderSchema = z.object({
  cart_id: catalogueIdSchema,
  [CART_FINGERPRINT_FIELD]: z.string().min(1).max(10_000),
});

const consentSchema = z.object({ consent: z.string().min(1) });

type CheckoutOutcome = Extract<
  ShopEvent,
  { event: 'storefront.checkout' }
>['outcome'];

export const POST: APIRoute = async ({ request, redirect }) => {
  const read = await readForm(request);
  if ('response' in read) return read.response;
  const form = Object.fromEntries(read.value ?? new FormData());
  const locale = localeFieldSchema.parse(form.locale);
  const report = (outcome: CheckoutOutcome, reason: string | null = null) =>
    reportShopEvent(request, { event: 'storefront.checkout', outcome, reason });
  const toCart = (notice: CartNotice, extra: Record<string, string> = {}) =>
    redirect(
      `${PathBuilder.partsCart(locale)}?${new URLSearchParams({ [CART_NOTICE_PARAM]: notice, ...extra })}`,
      303,
    );

  if (form[HONEYPOT_FIELD]) {
    report('honeypot');
    return toCart('ordered');
  }
  const contact = checkoutContactSchema.safeParse({ ...form, locale });
  if (!contact.success || !consentSchema.safeParse(form).success) {
    report('invalid', contact.success ? 'no_consent' : 'contact');
    return toCart('invalid');
  }
  const order = orderSchema.safeParse(form);
  const outcome = order.success
    ? await catalogueFor(request)?.placeOrder(
        order.data.cart_id,
        contact.data,
        order.data[CART_FINGERPRINT_FIELD],
      )
    : ({ kind: 'empty' } as const);
  if (outcome?.kind === 'order' && order.success) {
    report('placed');
    return toCart('ordered', {
      [ORDER_NUMBER_PARAM]: String(outcome.order.display_id),
      [ORDERED_CART_PARAM]: order.data.cart_id,
    });
  }
  const {
    notice,
    reason,
    logged,
  }: { notice: CartNotice; reason: NotPlacedReason; logged: CheckoutOutcome } =
    outcome?.kind === 'refused'
      ? {
          notice: refusalNotice(outcome.code),
          reason: outcome.code,
          logged: 'refused',
        }
      : outcome?.kind === 'empty'
        ? { notice: 'expired', reason: 'expired', logged: 'expired' }
        : {
            notice: 'unreachable',
            reason: 'unreachable',
            logged: 'unreachable',
          };
  report(logged, outcome?.kind === 'refused' ? outcome.code : null);
  const capped = await leadStore
    .failedCheckoutCapped(BRAND, contact.data.contact)
    .catch(() => false);
  if (capped) return toCart(notice);
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
      orderLeadSubmission(
        null,
        { ...contact.data, locale },
        summary,
        locale,
        new URL(request.url).origin,
      ),
      '[order]',
    ),
  );
  return toCart(notice);
};
