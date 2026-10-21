export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { HONEYPOT_FIELD, contactChannelSchema } from '@podbor/lead-crm';
import { isValidContact } from '@podbor/lead-crm/phone';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import { catalogueFromEnv, siteEnv } from '@/utils/catalogue';
import {
  CART_NOTICE_PARAM,
  refusalNotice,
  type CartNotice,
} from '@/utils/cartNotice';
import { PathBuilder } from '@/utils/paths';

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || undefined);

const orderSchema = z
  .object({
    cart_id: z.string().trim().min(1).max(100),
    contact: z.string().trim().min(1).max(200),
    contact_channel: contactChannelSchema.nullish().catch(null),
    name: optional(200),
    vin: optional(200),
    comment: optional(2000),
    consent: z.string().min(1),
  })
  .refine(({ contact, contact_channel }) =>
    isValidContact(contact, contact_channel ?? null),
  );

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
  if (!order.success) {
    return new Response(null, { status: 400 });
  }
  const { cart_id, contact, contact_channel, name, vin, comment } = order.data;
  const outcome = await catalogueFromEnv(siteEnv())?.placeOrder(cart_id, {
    contact,
    contact_channel: contact_channel ?? undefined,
    name,
    vin,
    comment,
    locale,
  });
  switch (outcome?.kind) {
    case 'order':
      return toCart('ordered');
    case 'refused':
      return toCart(refusalNotice(outcome.code));
    default:
      return toCart('unreachable');
  }
};
