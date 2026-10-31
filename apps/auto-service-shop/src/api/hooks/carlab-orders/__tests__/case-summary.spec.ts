import { Modules } from '@medusajs/framework/utils';
import { completeOrderWorkflow } from '@medusajs/medusa/core-flows';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const SHOP_LEAD_SECRET = 'shop-lead-secret';
const VIN = 'WBA8E9G50GNT12345';

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('the case summary of a completed shop Order', () => {
      const siteHeaders = {
        headers: { authorization: `Bearer ${SHOP_LEAD_SECRET}` },
      };

      const part = (brand: string, number: string) => ({
        slug: `${brand}-${number}`.toLowerCase(),
        brand,
        number,
        name: 'Масляный фильтр',
      });

      const placeOrder = (metadata: Record<string, unknown> = {}) =>
        getContainer()
          .resolve(Modules.ORDER)
          .createOrders({
            currency_code: 'rsd',
            email: 'buyer@carlab.rs',
            metadata: {
              fulfillment: 'cash_at_pickup',
              contact: '+381601234567',
              contact_channel: 'viber',
              name: 'Marko Petrovic',
              vin: VIN,
              car: 'BMW 3 серия F30 320d, B47D20O0',
              comment: 'Позвоните после обеда',
              ...metadata,
            },
            items: [
              {
                title: 'Масляный фильтр (MANN-FILTER HU 816 x)',
                quantity: 2,
                unit_price: 1850,
                metadata: part('MANN-FILTER', 'HU 816 x'),
              },
              {
                title: 'Замена масла',
                quantity: 1,
                unit_price: 2500,
                metadata: { addon_offer_id: 'offer_1', addon_kind: 'service' },
              },
              {
                title: 'Свеча зажигания (BOSCH 0 242 236 562)',
                quantity: 4,
                unit_price: 900,
                metadata: part('BOSCH', '0 242 236 562'),
              },
            ],
          });

      const complete = async (id: string) => {
        await completeOrderWorkflow(getContainer()).run({
          input: { orderIds: [id] },
        });
      };

      const summarise = (
        id: string,
        headers: { headers: Record<string, string> } = siteHeaders,
      ) =>
        api
          .get(`/hooks/carlab-orders/${id}/case-summary`, headers)
          .catch((error) => error.response);

      beforeAll(async () => {
        process.env.SHOP_LEAD_SECRET = SHOP_LEAD_SECRET;
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'CASE1',
        });
        const vinLookups: VinLookupModuleService =
          getContainer().resolve(VIN_LOOKUP_MODULE);
        await vinLookups.createVinLookups({
          vin: VIN,
          facts: {},
          make: 'bmw',
          code: 'CASE1',
          vehicle_id: vehicle.id,
        });
      });

      afterAll(() => {
        delete process.env.SHOP_LEAD_SECRET;
      });

      it('gives the car, the Parts and the RSD total, and nothing about the customer', async () => {
        const order = await placeOrder();
        await complete(order.id);

        const response = await summarise(order.id);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({
          summary: {
            display_id: order.display_id,
            car: { make: 'BMW', model: '3 серия F30 320d', year: 2016 },
            parts: [
              { brand: 'MANN-FILTER', number: 'HU 816 x' },
              { brand: 'BOSCH', number: '0 242 236 562' },
            ],
            total_rsd: 9800,
          },
        });
        const body = JSON.stringify(response.data);
        for (const secret of [
          VIN,
          'Marko',
          '381601234567',
          'viber',
          'Позвоните',
          'buyer@carlab.rs',
        ]) {
          expect(body).not.toContain(secret);
        }
      });

      it('leaves the car out when the VIN never resolved', async () => {
        const order = await placeOrder({ vin: 'WBA00000000000000' });
        await complete(order.id);

        const response = await summarise(order.id);

        expect(response.data.summary.car).toBeNull();
      });

      it('refuses an Order that is not completed', async () => {
        const order = await placeOrder();

        const response = await summarise(order.id);

        expect(response.status).toBe(409);
        expect(response.data.message).toBe(
          `Order ${order.id} is pending, not completed`,
        );
      });

      it.each([
        ['no secret', {}],
        ['a wrong secret', { authorization: 'Bearer wrong' }],
      ])('refuses a request carrying %s', async (_name, headers) => {
        const order = await placeOrder();
        await complete(order.id);

        const response = await summarise(order.id, { headers });

        expect(response.status).toBe(401);
      });

      it('refuses a staff session, which is not the site', async () => {
        const order = await placeOrder();
        await complete(order.id);
        const adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@case-summary.local',
          'supersecret',
        );

        const response = await summarise(order.id, adminHeaders);

        expect(response.status).toBe(401);
      });
    });
  },
});
