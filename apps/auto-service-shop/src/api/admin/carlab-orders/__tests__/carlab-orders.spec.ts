import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('/admin/carlab-orders', () => {
      let adminHeaders: { headers: { authorization: string } };
      const placed: Record<string, { id: string; display_id: number }> = {};

      const placeOrder = (metadata: Record<string, unknown>) =>
        getContainer()
          .resolve(Modules.ORDER)
          .createOrders({
            currency_code: 'rsd',
            email: 'buyer@carlab.rs',
            metadata: { fulfillment: 'cash_at_pickup', ...metadata },
            items: [
              {
                title: 'Масляный фильтр (BMW 11 42 8 575 211)',
                quantity: 2,
                unit_price: 1850,
                metadata: { in_stock: true, lead_time_days: 0 },
              },
            ],
          });

      beforeAll(async () => {
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@carlab-orders.local',
          'supersecret',
        );
        const contact = {
          contact: '+381601234567',
          contact_channel: 'viber',
          name: 'Marko',
          vin: 'WBA35BG070N074158',
        };
        placed.handedOff = await placeOrder({
          ...contact,
          lead_handed_off_at: new Date().toISOString(),
        });
        placed.failing = await placeOrder({
          ...contact,
          lead_handoff_error: 'The lead route answered 500',
          lead_handoff_attempts: 2,
        });
        placed.foreign = await getContainer()
          .resolve(Modules.ORDER)
          .createOrders({ currency_code: 'rsd', email: 'x@y.z', items: [] });
      });

      it('shows the staff who ordered, what, and whether the Lead reached the CRM', async () => {
        const { data } = await api.get(
          `/admin/carlab-orders/${placed.failing.id}`,
          adminHeaders,
        );

        expect(data.order).toMatchObject({
          display_id: placed.failing.display_id,
          cash_at_pickup: true,
          customer: {
            name: 'Marko',
            contact: '+381601234567',
            contact_channel: 'viber',
            vin: 'WBA35BG070N074158',
          },
          lines: [
            {
              title: 'Масляный фильтр (BMW 11 42 8 575 211)',
              quantity: 2,
              total: 3700,
              in_stock: true,
              lead_time_days: 0,
            },
          ],
          total: 3700,
          lead: {
            handed_off_at: null,
            attempts: 2,
            error: 'The lead route answered 500',
          },
        });
      });

      it('points the case draft at the storefront the Lead route names, else at carlab.rs', async () => {
        const storefront = async () =>
          (
            await api.get(
              `/admin/carlab-orders/${placed.failing.id}`,
              adminHeaders,
            )
          ).data.storefront_url;

        expect(await storefront()).toBe('https://carlab.rs');
        process.env.LEAD_ROUTE_URL = 'http://127.0.0.1:4331/api/leads';
        try {
          expect(await storefront()).toBe('http://127.0.0.1:4331');
        } finally {
          delete process.env.LEAD_ROUTE_URL;
        }
      });

      it('lists only the shop orders whose Lead has not reached the CRM', async () => {
        const { data } = await api.get('/admin/carlab-orders', adminHeaders);

        expect(data.orders).toEqual([
          expect.objectContaining({
            id: placed.failing.id,
            display_id: placed.failing.display_id,
            lead: expect.objectContaining({ attempts: 2 }),
          }),
        ]);
      });

      it('returns a 404 for an unknown order', async () => {
        const response = await api
          .get('/admin/carlab-orders/order_missing', adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });
    });
  },
});
