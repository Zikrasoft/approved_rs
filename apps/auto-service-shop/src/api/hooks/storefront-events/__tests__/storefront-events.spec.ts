import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import {
  STOREFRONT_EVENT_MAX_BYTES,
  STOREFRONT_EVENTS_PATH,
} from '@podbor/catalog-contract/events';

import {
  loggedEvents,
  watchEvents,
} from '../../../../../integration-tests/loggedEvents';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { DEMAND_MODULE } from '../../../../modules/demand';
import type DemandModuleService from '../../../../modules/demand/service';

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
  testSuite: ({ api, getContainer }) => {
    describe('POST /hooks/storefront-events', () => {
      watchEvents();

      let identifiers: Record<string, string>;

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const [mann, mannFilter] = await catalog.createBrands([
          { name: 'Mann', slug: 'mann' },
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);
        await catalog.createPartWithIdentifiers({
          name: 'Oil filter',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mannFilter.id,
              value: 'HU 816 x',
            },
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'FILTER-HU 816 x',
            },
          ],
        });
        identifiers = Object.fromEntries(
          (await catalog.listPartIdentifiers({}, { relations: ['brand'] })).map(
            ({ id, brand }) => [brand.slug, id],
          ),
        );
      });

      const demandOf = async (id: string) =>
        (
          await getContainer()
            .resolve<DemandModuleService>(DEMAND_MODULE)
            .countsSince(new Date(Date.now() - 86_400_000))
        ).find((counted) => counted.id === id);

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

      it('counts the numbers an inquiry named, logging how many and never which', async () => {
        const response = await post({
          event: 'storefront.demand',
          request_id: 'fra1::inquiry-1',
          signal: 'inquiry',
          parts: [
            'mann-filter-hu816x',
            'mann-filter-hu816x',
            'bosch-0986494524',
          ],
        });

        expect(response.status).toBe(204);
        expect(await demandOf(identifiers['mann-filter'])).toMatchObject({
          inquiries: 1,
        });
        expect(await demandOf(identifiers.mann)).toBeUndefined();
        expect(loggedEvents('storefront.demand')).toEqual([
          {
            event: 'storefront.demand',
            at: expect.any(String),
            request_id: 'fra1::inquiry-1',
            signal: 'inquiry',
            parts: 2,
            matched: 1,
          },
        ]);
        expect(JSON.stringify(loggedEvents())).not.toContain('hu816x');
      });

      it('reads the Brand from the slug before its number, which never holds a dash', async () => {
        await post({
          event: 'storefront.demand',
          signal: 'pick',
          parts: ['mann-filterhu816x'],
        });

        expect(await demandOf(identifiers.mann)).toMatchObject({ picks: 1 });
      });

      it('counts nothing for numbers the catalogue does not hold', async () => {
        const response = await post({
          event: 'storefront.demand',
          signal: 'inquiry',
          parts: ['nobrand-123456'],
        });

        expect(response.status).toBe(204);
        expect(loggedEvents('storefront.demand')).toEqual([
          expect.objectContaining({ parts: 1, matched: 0 }),
        ]);
      });

      it('counts a redelivered event once, by its request id', async () => {
        const pick = {
          event: 'storefront.demand',
          request_id: 'fra1::pick-1',
          signal: 'pick',
          parts: ['mann-filter-hu816x'],
        };
        const before = (await demandOf(identifiers['mann-filter']))?.picks ?? 0;

        await post(pick);
        await post(pick);

        expect((await demandOf(identifiers['mann-filter']))?.picks).toBe(
          before + 1,
        );
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
