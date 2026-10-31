import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { retryOrderLeadsAt } from '../../../../jobs/retry-order-leads';
import { LEAD_HANDOFF_MAX_ATTEMPTS } from '../../../../lib/order-lead';

const SHOP_LEAD_SECRET = 'shop-lead-secret';
const SHOP_ORDER_OUTCOME_SECRET = 'shop-order-outcome-secret';

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('a shop Order decided in the CRM bot', () => {
      let adminHeaders: { headers: { authorization: string } };
      const botHeaders = {
        headers: { authorization: `Bearer ${SHOP_ORDER_OUTCOME_SECRET}` },
      };
      let leadRoute: Server;
      let leadRouteStatus = 204;
      const posts: { authorization?: string; body: Record<string, string> }[] =
        [];

      const placeOrder = (metadata: Record<string, unknown> = {}) =>
        getContainer()
          .resolve(Modules.ORDER)
          .createOrders({
            currency_code: 'rsd',
            email: 'buyer@carlab.rs',
            metadata: {
              fulfillment: 'cash_at_pickup',
              contact: '+381601234567',
              lead_handed_off_at: new Date().toISOString(),
              ...metadata,
            },
            items: [{ title: 'Oil filter', quantity: 1, unit_price: 1850 }],
          });

      const statusOf = async (id: string) =>
        (await getContainer().resolve(Modules.ORDER).retrieveOrder(id)).status;

      const decide = (
        id: string,
        outcome: string,
        headers: { headers: Record<string, string> } = botHeaders,
      ) =>
        api
          .post(`/hooks/carlab-orders/${id}/outcome`, { outcome }, headers)
          .catch((error) => error.response);

      const waitFor = async <T>(read: () => Promise<T> | T) => {
        for (let tries = 0; tries < 50; tries += 1) {
          const value = await read();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return read();
      };

      beforeAll(async () => {
        leadRoute = createServer((request, response) => {
          let body = '';
          request.on('data', (chunk) => (body += chunk));
          request.on('end', () => {
            posts.push({
              authorization: request.headers.authorization,
              body: Object.fromEntries(new URLSearchParams(body)),
            });
            response.writeHead(leadRouteStatus).end();
          });
        });
        await new Promise<void>((resolve) => leadRoute.listen(0, resolve));
        process.env.LEAD_ROUTE_URL = `http://localhost:${(leadRoute.address() as AddressInfo).port}/api/leads`;
        process.env.SHOP_LEAD_SECRET = SHOP_LEAD_SECRET;
        process.env.SHOP_ORDER_OUTCOME_SECRET = SHOP_ORDER_OUTCOME_SECRET;

        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@order-outcome.local',
          'supersecret',
        );
      });

      beforeEach(() => {
        posts.length = 0;
        leadRouteStatus = 204;
      });

      afterAll(async () => {
        delete process.env.LEAD_ROUTE_URL;
        delete process.env.SHOP_LEAD_SECRET;
        delete process.env.SHOP_ORDER_OUTCOME_SECRET;
        await new Promise((resolve) => leadRoute.close(resolve));
      });

      it('completes the Order when its Lead is won, and again without harm', async () => {
        const order = await placeOrder();

        const first = await decide(order.id, 'completed');
        const again = await decide(order.id, 'completed');

        expect([first.status, again.status]).toEqual([200, 200]);
        expect(await statusOf(order.id)).toBe('completed');
      });

      it('cancels the Order when its Lead is lost, without telling the bot back', async () => {
        const order = await placeOrder();

        const response = await decide(order.id, 'canceled');

        expect(response.status).toBe(200);
        expect(await statusOf(order.id)).toBe('canceled');
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(posts).toEqual([]);
      });

      it('refuses the other outcome once one is set', async () => {
        const order = await placeOrder();
        await decide(order.id, 'completed');

        const response = await decide(order.id, 'canceled');

        expect(response.status).toBe(409);
        expect(await statusOf(order.id)).toBe('completed');
      });

      it.each([
        ['no secret', {}],
        ['a wrong secret', { authorization: 'Bearer wrong' }],
        ['a staff session', null],
      ])('refuses a decision carrying %s', async (_name, headers) => {
        const order = await placeOrder();

        const response = await decide(order.id, 'completed', {
          headers: headers ?? adminHeaders.headers,
        });

        expect(response.status).toBe(401);
        expect(await statusOf(order.id)).toBe('pending');
      });

      it('refuses every decision while the secret is unset', async () => {
        const order = await placeOrder();
        delete process.env.SHOP_ORDER_OUTCOME_SECRET;

        const response = await decide(order.id, 'completed');
        process.env.SHOP_ORDER_OUTCOME_SECRET = SHOP_ORDER_OUTCOME_SECRET;

        expect(response.status).toBe(401);
        expect(await statusOf(order.id)).toBe('pending');
      });

      it('marks the Lead lost when staff cancel the Order in the shop admin', async () => {
        const order = await placeOrder();

        await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);

        await waitFor(() => posts.length);
        expect(posts).toEqual([
          {
            authorization: `Bearer ${SHOP_LEAD_SECRET}`,
            body: { order_id: order.id, order_outcome: 'canceled' },
          },
        ]);
      });

      it('retries a cancel the bot did not take until it does', async () => {
        leadRouteStatus = 503;
        const order = await placeOrder();
        await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
        await waitFor(() => posts.length);

        leadRouteStatus = 204;
        await retryOrderLeadsAt(getContainer(), new Date());
        await retryOrderLeadsAt(getContainer(), new Date());

        expect(posts).toHaveLength(2);
      });

      it('stops telling the bot a cancel it refused because the Lead is won', async () => {
        leadRouteStatus = 409;
        const order = await placeOrder();
        const metadataOf = async () =>
          (await getContainer().resolve(Modules.ORDER).retrieveOrder(order.id))
            .metadata ?? {};

        await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
        await waitFor(async () => (await metadataOf()).lead_cancel_refused_at);
        await retryOrderLeadsAt(getContainer(), new Date());

        expect(
          posts.filter(({ body }) => body.order_id === order.id),
        ).toHaveLength(1);
        expect((await metadataOf()).lead_cancel_refused_at).toEqual(
          expect.any(String),
        );
        expect((await metadataOf()).lead_lost_at).toBeUndefined();
      });

      it.each([503, 404])(
        'gives up on a cancel the bot keeps answering %s',
        async (status) => {
          leadRouteStatus = status;
          const order = await placeOrder();
          await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
          await waitFor(
            async () =>
              (
                await getContainer()
                  .resolve(Modules.ORDER)
                  .retrieveOrder(order.id)
              ).metadata?.lead_lost_attempts,
          );

          for (let run = 0; run < 15; run += 1) {
            await retryOrderLeadsAt(getContainer(), new Date());
          }

          expect(
            posts.filter(({ body }) => body.order_id === order.id),
          ).toHaveLength(LEAD_HANDOFF_MAX_ATTEMPTS);
        },
      );

      it('hands a canceled Order that never reached the bot to nobody', async () => {
        const order = await placeOrder({ lead_handed_off_at: null });
        await getContainer()
          .resolve(Modules.ORDER)
          .updateOrders(order.id, { status: 'canceled' });

        await retryOrderLeadsAt(
          getContainer(),
          new Date(Date.now() + 5 * 60 * 1000),
        );

        expect(posts.filter(({ body }) => body.order_id === order.id)).toEqual(
          [],
        );
      });

      it('tells the bot nothing about an Order whose Lead never reached it', async () => {
        const order = await placeOrder({ lead_handed_off_at: null });

        await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
        await retryOrderLeadsAt(getContainer(), new Date());

        expect(posts.filter(({ body }) => body.order_id === order.id)).toEqual(
          [],
        );
      });
    });
  },
});
