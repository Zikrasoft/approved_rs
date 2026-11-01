import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import {
  STOREFRONT_EVENT_MAX_BYTES,
  STOREFRONT_EVENTS_PATH,
} from '@podbor/catalog-contract/events';

import {
  loggedEvents,
  watchEvents,
} from '../../../../../integration-tests/loggedEvents';

const CURRENT = 'events-secret-current-0123456789abcdef';
const PREVIOUS = 'events-secret-previous-0123456789abcdef';
const RATE_LIMIT = 30;

process.env.SHOP_EVENTS_SECRET = CURRENT;
process.env.SHOP_EVENTS_SECRET_PREVIOUS = PREVIOUS;
process.env.STOREFRONT_EVENTS_PER_MINUTE = String(RATE_LIMIT);

const CHECKOUT = {
  event: 'storefront.checkout',
  outcome: 'placed',
  reason: null,
};

medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    describe('POST /hooks/storefront-events', () => {
      watchEvents();

      const post = (body: unknown, secret: string | null = CURRENT) =>
        api
          .post(STOREFRONT_EVENTS_PATH, body, {
            headers: secret ? { authorization: `Bearer ${secret}` } : {},
          })
          .catch((error) => error.response);

      it('logs an event under the storefront request id', async () => {
        const response = await post({
          ...CHECKOUT,
          request_id: 'fra1::iad1::checkout-1',
        });

        expect(response.status).toBe(204);
        expect(loggedEvents('storefront.checkout')).toEqual([
          {
            event: 'storefront.checkout',
            at: expect.any(String),
            request_id: 'fra1::iad1::checkout-1',
            outcome: 'placed',
            reason: null,
          },
        ]);
      });

      it('falls back to its own request id when the storefront sent none', async () => {
        await post(CHECKOUT);

        const [request] = loggedEvents('store.request');
        expect(loggedEvents('storefront.checkout')[0].request_id).toBe(
          request.request_id,
        );
        expect(request).toMatchObject({
          route: 'POST /hooks/storefront-events',
          status: 204,
        });
      });

      it('takes the previous secret while one rotates, and nothing else', async () => {
        expect((await post(CHECKOUT, PREVIOUS)).status).toBe(204);
        expect((await post(CHECKOUT, 'not-the-secret')).status).toBe(401);
        expect((await post(CHECKOUT, null)).status).toBe(401);
        expect(loggedEvents('storefront.checkout')).toHaveLength(1);
      });

      it('drops a key the vocabulary does not name', async () => {
        await post({
          event: 'storefront.lead',
          source: 'leads',
          service: null,
          outcome: 'stored',
          reason: null,
          contact: '+381601234567',
          name: 'Petar',
        });

        const text = JSON.stringify(loggedEvents());
        expect(loggedEvents('storefront.lead')).toHaveLength(1);
        expect(text).not.toContain('381601234567');
        expect(text).not.toContain('Petar');
      });

      it.each([
        ['an unknown event', { event: 'storefront.nope' }],
        ['a missing field', { event: 'storefront.checkout', reason: null }],
        [
          'a phone number in a code field',
          { ...CHECKOUT, outcome: 'refused', reason: 'x381601234567' },
        ],
        [
          'free text in a code field',
          { ...CHECKOUT, outcome: 'refused', reason: 'call Petar' },
        ],
        ['an array', [CHECKOUT]],
      ])('refuses %s without logging it', async (_, body) => {
        const response = await post(body);

        expect(response.status).toBe(400);
        expect(loggedEvents('store.request')).toEqual([
          expect.objectContaining({ outcome: 'refused', status: 400 }),
        ]);
        expect(
          loggedEvents().filter(({ event }) =>
            String(event).startsWith('storefront.'),
          ),
        ).toEqual([]);
      });

      it('refuses a body over the size cap', async () => {
        const response = await post({
          ...CHECKOUT,
          padding: 'x'.repeat(STOREFRONT_EVENT_MAX_BYTES),
        });

        expect(response.status).toBe(413);
        expect(loggedEvents('storefront.checkout')).toEqual([]);
      });

      it('answers 429 once the minute is spent', async () => {
        let retryAfter: string | undefined;
        for (let sent = 0; sent <= RATE_LIMIT && !retryAfter; sent += 1) {
          const response = await post(CHECKOUT);
          if (response.status === 429)
            retryAfter = response.headers['retry-after'];
        }

        expect(retryAfter).toMatch(/^\d+$/);
      });
    });
  },
});
