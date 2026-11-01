import { describe, expect, it, vi } from 'vitest';
import {
  createShopEvents,
  reportedNotifyLead,
  SHOP_EVENT_TIMEOUT_MS,
} from './shopEvents';

const ENV = {
  MEDUSA_BACKEND_URL: 'https://api.carlab.test',
  SHOP_EVENTS_SECRET: 'events-secret',
};
const CHECKOUT = {
  event: 'storefront.checkout',
  outcome: 'placed',
  reason: null,
} as const;

const setUp = (
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  env: Record<string, string | undefined> = ENV,
) => {
  const kept: Promise<unknown>[] = [];
  const fetchMock = vi.fn(fetch);
  const report = createShopEvents({
    fetch: fetchMock as never,
    keepAlive: (sending) => kept.push(sending),
    env: () => env,
  });
  return { report, fetchMock, kept };
};

describe('createShopEvents', () => {
  it('posts the event with the bearer secret and the Vercel request id, kept alive past the response', async () => {
    const { report, fetchMock, kept } = setUp(
      async () => new Response(null, { status: 204 }),
    );

    report(
      new Request('https://carlab.rs/api/order', {
        headers: { 'x-vercel-id': 'fra1::abc-1' },
      }),
      CHECKOUT,
    );
    await Promise.all(kept);

    expect(kept).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.carlab.test/hooks/storefront-events');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      authorization: 'Bearer events-secret',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      ...CHECKOUT,
      request_id: 'fra1::abc-1',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(SHOP_EVENT_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });

  it('sends a null request id without a request or with a malformed one', async () => {
    const { report, fetchMock, kept } = setUp(
      async () => new Response(null, { status: 204 }),
    );

    report(null, CHECKOUT);
    report(
      new Request('https://carlab.rs/', {
        headers: { 'x-vercel-id': 'a b' },
      }),
      CHECKOUT,
    );
    await Promise.all(kept);

    expect(
      fetchMock.mock.calls.map(
        ([, init]) => JSON.parse(String(init.body)).request_id,
      ),
    ).toEqual([null, null]);
  });

  it.each([
    ['no backend', { SHOP_EVENTS_SECRET: 'events-secret' }],
    ['no secret', { MEDUSA_BACKEND_URL: 'https://api.carlab.test' }],
    ['an empty secret', { ...ENV, SHOP_EVENTS_SECRET: '' }],
  ])('sends nothing with %s', (_, env) => {
    const { report, fetchMock, kept } = setUp(
      async () => new Response(null),
      env,
    );

    report(null, CHECKOUT);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(kept).toEqual([]);
  });

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
    [
      'a refusal',
      async () => new Response('{"message":"no"}', { status: 401 }),
    ],
    [
      'a fetch that throws at once',
      () => {
        throw new Error('sync boom');
      },
    ],
  ])('never fails the caller on %s', async (_, fetch) => {
    const { report, kept } = setUp(fetch as never);

    expect(() => report(null, CHECKOUT)).not.toThrow();
    await expect(Promise.all(kept)).resolves.toEqual([undefined]);
  });
});

describe('reportedNotifyLead', () => {
  const submission = (service: string) =>
    ({ service, contact: '+381601234567', name: 'Petar' }) as never;

  it.each([
    [{ stored: true, delivered: true }, 'stored', null],
    [{ stored: true, delivered: false }, 'stored', 'not_delivered'],
    [{ stored: false, delivered: true }, 'stored', 'not_stored'],
    [{ stored: false, delivered: false }, 'failed', 'not_stored'],
  ])(
    'reports %j as %s (%s) and returns it',
    async (result, outcome, reason) => {
      const report = vi.fn();
      const notify = reportedNotifyLead(async () => result, report);

      expect(await notify(submission('vin-parts-inquiry'), '[leads]')).toBe(
        result,
      );
      expect(report).toHaveBeenCalledWith(null, {
        event: 'storefront.lead',
        source: 'leads',
        service: 'vin-parts-inquiry',
        outcome,
        reason,
      });
    },
  );

  it.each(['', 'call 0641234567', 'x381601234567'])(
    'reports a service %j that is not a slug as none, and never the contact',
    async (service) => {
      const report = vi.fn();
      const notify = reportedNotifyLead(
        async () => ({ stored: true, delivered: true }),
        report,
      );

      await notify(submission(service), '[contact-click]');

      const [[, event]] = report.mock.calls;
      expect(event).toMatchObject({ source: 'contact-click', service: null });
      expect(JSON.stringify(event)).not.toMatch(/381601234567|Petar/);
    },
  );
});
