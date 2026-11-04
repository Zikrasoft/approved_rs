import { createHmac } from 'node:crypto';

import type { StorefrontEvent } from '@podbor/catalog-contract/events';
import { typedPhone } from '@podbor/lead-crm/phone';
import { vinOf } from '@podbor/lead-crm/vin';
import { z } from 'zod';

export type SearchIntent = 'vin' | 'number' | 'car' | 'text' | 'browse';

type StorefrontEvents = {
  [E in StorefrontEvent as E['event']]: Omit<E, 'event' | 'request_id'>;
};

export type ShopEvents = Omit<StorefrontEvents, 'storefront.demand'> & {
  'storefront.demand': {
    signal: StorefrontEvents['storefront.demand']['signal'];
    parts: number;
    matched: number;
  };
  'store.request': {
    outcome: 'ok' | 'refused' | 'failed';
    reason: string | null;
    method: string;
    route: string;
    status: number;
    duration_ms: number;
    client: string;
  };
  'store.error': {
    outcome: 'failed';
    reason: string;
    route: string;
    status: number;
    cause: string;
  };
  search: {
    outcome: 'found' | 'empty';
    intent: SearchIntent;
    results: number;
    zero: boolean;
    query: string | null;
    category: string | null;
    scoped: boolean;
  };
  'vin.lookup': {
    outcome: 'resolved' | 'unresolved';
    reason: 'not_decoded' | 'no_vehicle' | 'ambiguous' | null;
    make: string | null;
    code: string | null;
    wmi: string;
    vin: string;
    candidates: number;
  };
  'order.handoff': {
    outcome:
      | 'delivered'
      | 'failed'
      | 'deferred'
      | 'refused'
      | 'alerted'
      | 'alert_failed';
    reason: string | null;
    kind: 'placed' | 'canceled';
    order: string;
    cause: string | null;
  };
  'catalogue.run': {
    outcome: 'succeeded' | 'failed';
    reason: string | null;
    kind: string;
    run: string;
    supplier: string | null;
    duration_ms: number;
    cause: string | null;
    counts: Record<string, number>;
  };
};

export type EventName = keyof ShopEvents;

export function logEvent<Name extends EventName>(
  event: Name,
  fields: ShopEvents[Name],
  requestId: string | null = null,
): void {
  try {
    console.log(
      JSON.stringify({
        event,
        at: new Date().toISOString(),
        request_id: requestId,
        ...fields,
      }),
    );
  } catch {
    return;
  }
}

export const logStorefrontEvent = (
  {
    event,
    request_id,
    ...fields
  }: Exclude<StorefrontEvent, { event: 'storefront.demand' }>,
  fallbackId: string | null,
): void =>
  logEvent(event, fields as ShopEvents[typeof event], request_id ?? fallbackId);

const HASH_LENGTH = 12;
const hashKeySchema = z.string().catch('');

export const hashed = (kind: 'client' | 'vin', value: string): string =>
  createHmac('sha256', hashKeySchema.parse(process.env.COOKIE_SECRET))
    .update(`carlab-log|${kind}|${value}`)
    .digest('hex')
    .slice(0, HASH_LENGTH);

export const vinFields = (vin: string) => ({
  wmi: vin.slice(0, 3),
  vin: hashed('vin', vin),
});

export const MAX_CAUSE_LENGTH = 500;

const causeChain = (error: unknown): string => {
  if (!(error instanceof Error)) return typeof error;
  const cause =
    'cause' in error && error.cause !== undefined
      ? ` <- ${causeChain(error.cause)}`
      : '';
  return `${error.name}: ${error.message}${cause}`;
};

export const causeOf = (error: unknown): string =>
  causeChain(error).slice(0, MAX_CAUSE_LENGTH);

const MAX_QUERY_LENGTH = 64;

export const loggedQuery = (query: string): string | null => {
  const text = query.trim().replace(/\s+/g, ' ').toLowerCase();
  const personal =
    !text || text.includes('@') || vinOf(text) || typedPhone(text, 'RS');
  return personal ? null : text.slice(0, MAX_QUERY_LENGTH);
};
