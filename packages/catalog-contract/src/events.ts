import { z } from 'zod';

export const STOREFRONT_EVENTS_PATH = '/hooks/storefront-events';
export const REQUEST_ID_HEADER = 'x-request-id';
export const VISITOR_ID_HEADER = 'x-visitor-id';
export const STOREFRONT_EVENT_MAX_BYTES = 4096;

export const requestIdSchema = z.string().regex(/^[\w:.-]{1,128}$/);

export const eventCodeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_.-]{0,63}$/i)
  .refine((value) => !/\d{7}/.test(value), 'looks like a phone number');
const code = eventCodeSchema;
const count = z.number().int().nonnegative().max(1e9);
export const MAX_DEMAND_PARTS = 50;
export const DEMAND_SIGNALS = ['inquiry', 'pick'] as const;
const partSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(128);
const host = z.string().regex(/^[a-z0-9.:[\]-]{1,253}$/i);

const event = <Name extends string, Shape extends z.ZodRawShape>(
  name: Name,
  shape: Shape,
) =>
  z.object({
    event: z.literal(name),
    request_id: requestIdSchema.nullable().catch(null),
    ...shape,
  });

export const storefrontEventSchema = z.discriminatedUnion('event', [
  event('storefront.search', {
    route: z.enum(['suggest', 'count']),
    intent: z.enum(['vin', 'query', 'empty']),
    outcome: z.enum(['ok', 'unavailable', 'skipped']),
    results: count.nullable(),
    duration_ms: z.number().nonnegative().max(600_000),
  }),
  event('storefront.lead', {
    source: code,
    service: code.nullable(),
    outcome: z.enum(['stored', 'failed', 'refused']),
    reason: code.nullable(),
  }),
  event('storefront.cart', {
    action: z.enum(['view', 'add', 'quantity', 'addon', 'remove']),
    outcome: code,
    reason: code.nullable(),
  }),
  event('storefront.checkout', {
    outcome: z.enum([
      'placed',
      'refused',
      'expired',
      'unreachable',
      'invalid',
      'honeypot',
    ]),
    reason: code.nullable(),
  }),
  event('storefront.csp', { directive: code, blocked: host }),
  event('storefront.demand', {
    signal: z.enum(DEMAND_SIGNALS),
    parts: z.array(partSlug).min(1).max(MAX_DEMAND_PARTS),
  }),
]);

export type StorefrontEvent = z.infer<typeof storefrontEventSchema>;
export type StorefrontEventInput = z.input<typeof storefrontEventSchema>;
