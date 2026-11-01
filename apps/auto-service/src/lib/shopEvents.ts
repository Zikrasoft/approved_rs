import { waitUntil } from '@vercel/functions';
import {
  eventCodeSchema,
  STOREFRONT_EVENTS_PATH,
  type StorefrontEventInput,
} from '@podbor/catalog-contract/events';
import type { NotifyLead } from '@podbor/lead-crm';
import { z } from 'zod';
import { requestIdOf } from '@/utils/catalogueEnv';

export const SHOP_EVENT_TIMEOUT_MS = 2000;

export type ShopEvent = StorefrontEventInput extends infer Event
  ? Event extends unknown
    ? Omit<Event, 'request_id'>
    : never
  : never;

const eventsEnvSchema = z.object({
  MEDUSA_BACKEND_URL: z.url(),
  SHOP_EVENTS_SECRET: z.string().min(1),
});

type EventsEnv = Partial<Record<keyof z.infer<typeof eventsEnvSchema>, string>>;

type ShopEventsOptions = {
  fetch?: typeof globalThis.fetch;
  keepAlive?: (sending: Promise<unknown>) => void;
  env?: () => EventsEnv;
};

const siteEventsEnv = (): EventsEnv => ({
  MEDUSA_BACKEND_URL: import.meta.env.MEDUSA_BACKEND_URL,
  SHOP_EVENTS_SECRET: process.env.SHOP_EVENTS_SECRET,
});

export const createShopEvents =
  ({
    fetch = (input, init) => globalThis.fetch(input, init),
    keepAlive = waitUntil,
    env = siteEventsEnv,
  }: ShopEventsOptions = {}) =>
  (request: Request | null, event: ShopEvent): void => {
    const config = eventsEnvSchema.safeParse(env());
    if (!config.success) return;
    const { MEDUSA_BACKEND_URL, SHOP_EVENTS_SECRET } = config.data;
    const sending = Promise.resolve()
      .then(() =>
        fetch(`${MEDUSA_BACKEND_URL}${STOREFRONT_EVENTS_PATH}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${SHOP_EVENTS_SECRET}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            ...event,
            request_id: request ? (requestIdOf(request) ?? null) : null,
          }),
          signal: AbortSignal.timeout(SHOP_EVENT_TIMEOUT_MS),
        }),
      )
      .then(
        (response) => response.body?.cancel(),
        () => undefined,
      )
      .catch(() => undefined);
    keepAlive(sending);
  };

export const reportShopEvent = createShopEvents();

type SearchEvent = Extract<ShopEvent, { event: 'storefront.search' }>;

export const searchReporter = (
  request: Request,
  route: SearchEvent['route'],
  report = reportShopEvent,
) => {
  const started = performance.now();
  return (
    intent: SearchEvent['intent'],
    outcome: SearchEvent['outcome'],
    results: number | null = null,
  ) =>
    report(request, {
      event: 'storefront.search',
      route,
      intent,
      outcome,
      results,
      duration_ms: Math.round(performance.now() - started),
    });
};

const leadOutcome = ({
  stored,
  delivered,
}: {
  stored: boolean;
  delivered: boolean;
}) => ({
  outcome: stored || delivered ? ('stored' as const) : ('failed' as const),
  reason: !stored ? 'not_stored' : !delivered ? 'not_delivered' : null,
});

const serviceSchema = eventCodeSchema.nullable().catch(null);

export const reportedNotifyLead =
  (notifyLead: NotifyLead, report = reportShopEvent): NotifyLead =>
  async (submission, logPrefix, handOff) => {
    const result = await notifyLead(submission, logPrefix, handOff);
    report(null, {
      event: 'storefront.lead',
      source: logPrefix.replace(/[^a-z-]/g, ''),
      service: serviceSchema.parse(submission.service || null),
      ...leadOutcome(result),
    });
    return result;
  };
