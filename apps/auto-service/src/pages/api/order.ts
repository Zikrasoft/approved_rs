export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  CART_FINGERPRINT_FIELD,
  checkoutContactSchema,
} from '@podbor/catalog-contract';
import { HONEYPOT_FIELD } from '@podbor/lead-crm';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import {
  catalogueFromEnv,
  catalogueIdSchema,
  siteEnv,
} from '@/utils/catalogue';
import {
  CART_NOTICE_PARAM,
  ORDER_NUMBER_PARAM,
  ORDERED_CART_PARAM,
  refusalNotice,
  type CartNotice,
} from '@/utils/cartNotice';
import { PathBuilder } from '@/utils/paths';
import { previewRequested } from '@/scripts/shopPreview';

const orderSchema = z.object({
  cart_id: catalogueIdSchema,
  consent: z.string().min(1),
  [CART_FINGERPRINT_FIELD]: z.string().min(1).max(10_000),
});

const localeSchema = z.enum(SUPPORTED_LOCALES).catch(PRIMARY_LOCALE);

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = Object.fromEntries(
    await request.formData().catch(() => new FormData()),
  );
  const locale = localeSchema.parse(form.locale);
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
  switch (outcome?.kind) {
    case 'order':
      return toCart('ordered', {
        [ORDER_NUMBER_PARAM]: String(outcome.order.display_id),
        [ORDERED_CART_PARAM]: order.data.cart_id,
      });
    case 'refused':
      return toCart(refusalNotice(outcome.code));
    case 'empty':
      return toCart('expired');
    default:
      return toCart('unreachable');
  }
};
