export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { checkoutContactSchema } from '@podbor/catalog-contract';
import { HONEYPOT_FIELD } from '@podbor/lead-crm';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import {
  catalogueFromEnv,
  catalogueIdSchema,
  siteEnv,
} from '@/utils/catalogue';
import {
  CART_NOTICE_PARAM,
  refusalNotice,
  type CartNotice,
} from '@/utils/cartNotice';
import { PathBuilder } from '@/utils/paths';

const orderSchema = z.object({
  cart_id: catalogueIdSchema,
  consent: z.string().min(1),
});

const localeSchema = z.enum(SUPPORTED_LOCALES).catch(PRIMARY_LOCALE);

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = Object.fromEntries(await request.formData());
  const locale = localeSchema.parse(form.locale);
  const toCart = (notice: CartNotice) =>
    redirect(
      `${PathBuilder.partsCart(locale)}?${CART_NOTICE_PARAM}=${notice}`,
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
  const outcome = await catalogueFromEnv(siteEnv())?.placeOrder(
    order.data.cart_id,
    contact.data,
  );
  switch (outcome?.kind) {
    case 'order':
      return toCart('ordered');
    case 'refused':
      return toCart(refusalNotice(outcome.code));
    default:
      return toCart('unreachable');
  }
};
