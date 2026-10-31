import { z } from 'zod';
import { TRACKED_CONTACT_CHANNELS } from './contactChannel.ts';
import { AD_SOURCE_FIELD, META_IDS_FIELD } from './fields.ts';
import {
  MAX_COMMENT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_URL_LENGTH,
} from './limits.ts';
import {
  isValidContact,
  plainText,
  singleLine,
  storedContact,
} from './phone.ts';

export const SHOP_ORDERS_PATH = '/api/shop-orders';

export const ORDER_OUTCOMES = ['completed', 'canceled'] as const;

export type OrderOutcome = (typeof ORDER_OUTCOMES)[number];

export const orderOutcomePath = (orderId: string): string =>
  `/hooks/carlab-orders/${encodeURIComponent(orderId)}/outcome`;

const attribution = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined);

const optionalText = (max: number, clean = singleLine) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().max(max))
    .nullish()
    .transform((value) => value || undefined);

export const orderContactObject = z.object({
  contact: z
    .string()
    .transform(singleLine)
    .pipe(z.string().min(1).max(MAX_FIELD_LENGTH)),
  contact_channel: z.enum(TRACKED_CONTACT_CHANNELS).optional().catch(undefined),
  name: optionalText(MAX_FIELD_LENGTH),
  vin: optionalText(MAX_FIELD_LENGTH),
  car: optionalText(MAX_FIELD_LENGTH),
  comment: optionalText(MAX_COMMENT_LENGTH, plainText),
  locale: attribution(MAX_FIELD_LENGTH),
  source_url: attribution(MAX_URL_LENGTH),
  visitor_id: attribution(MAX_FIELD_LENGTH),
  [AD_SOURCE_FIELD]: attribution(MAX_COMMENT_LENGTH),
  [META_IDS_FIELD]: attribution(MAX_COMMENT_LENGTH),
});

type CheckedFields = Pick<
  z.output<typeof orderContactObject>,
  'contact' | 'contact_channel'
>;

export const withValidContact = <S extends z.ZodType<CheckedFields>>(
  schema: S,
) =>
  schema
    .refine(({ contact, contact_channel }) =>
      isValidContact(contact, contact_channel ?? null),
    )
    .transform((value) => ({
      ...value,
      contact: storedContact(value.contact),
    }));

export const orderContactSchema = withValidContact(orderContactObject);

const orderId = z.string().min(1).max(MAX_FIELD_LENGTH);

export const orderLeadSchema = z.object({
  event: z.literal('placed'),
  order_id: orderId,
  contact: orderContactSchema,
  summary: z.string().min(1).max(MAX_COMMENT_LENGTH),
});

export const orderCancelSchema = z.object({
  event: z.literal('canceled'),
  order_id: orderId,
});

export const shopOrderEventSchema = z.discriminatedUnion('event', [
  orderLeadSchema,
  orderCancelSchema,
]);

export type OrderContact = z.output<typeof orderContactSchema>;
export type OrderLead = z.input<typeof orderLeadSchema>;
export type ShopOrderEvent = z.input<typeof shopOrderEventSchema>;

export const ORDER_MISSING = 'order_missing';
const SHOP_ORDER_UNKNOWN = 404;
const SHOP_ORDER_CONFLICT = 409;
const orderMissingSchema = z.object({ type: z.literal(ORDER_MISSING) });

export const outcomeRefused = (status: number, body: unknown): boolean =>
  status === SHOP_ORDER_CONFLICT ||
  (status === SHOP_ORDER_UNKNOWN && orderMissingSchema.safeParse(body).success);

export const LEAD_WON = 409;
export const LEAD_MISSING = 410;
// TODO: drop LEGACY_LEAD_MISSING together with the /api/leads fallback in the shop's sendShopOrderEvent; only that legacy route answers 404 for a missing Lead, and once it is gone a 404 means the route itself is missing.
const LEGACY_LEAD_MISSING = 404;

export const cancelRefused = (status: number): boolean =>
  status === LEAD_WON ||
  status === LEAD_MISSING ||
  status === LEGACY_LEAD_MISSING;
