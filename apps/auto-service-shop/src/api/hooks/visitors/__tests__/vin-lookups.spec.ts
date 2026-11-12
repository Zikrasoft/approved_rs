import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const SHOP_VISITOR_SEARCHES_SECRET = 'visitor-searches-secret';
const VISITOR = '1c9b5a6f-7d2e-4f3a-8b4c-8d9e0f1a2b3c';
const STRANGER = '0b8a4f5e-6c1d-4e2f-9a3b-7c8d9e0f1a2b';

const record = (
  vin: string,
  make_key: string,
  code: string,
  vehicleId: string | null = null,
) => ({
  vin,
  decoder: 'test',
  decoder_version: 1,
  raw: null,
  facts: {},
  make_key,
  code,
  code_type: 'bmw-type-code' as const,
  vehicle_id: vehicleId,
});

const site = (visitorId: string | null) => ({
  source: 'storefront' as const,
  bot: false,
  visitor_id: visitorId,
});

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('the VIN lookups of one visitor', () => {
      const siteHeaders = {
        headers: { authorization: `Bearer ${SHOP_VISITOR_SEARCHES_SECRET}` },
      };

      const lookupsOf = (
        visitorId: string,
        headers: { headers: Record<string, string> } = siteHeaders,
      ) =>
        api
          .get(`/hooks/visitors/${visitorId}/vin-lookups`, headers)
          .catch((error) => error.response);

      beforeAll(async () => {
        process.env.SHOP_VISITOR_SEARCHES_SECRET = SHOP_VISITOR_SEARCHES_SECRET;
        process.env.SHOP_LEAD_SECRET = 'shop-lead-secret';
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const vinLookups: VinLookupModuleService =
          getContainer().resolve(VIN_LOOKUP_MODULE);
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'HOOK1',
        });
        const saves: [ReturnType<typeof record>, string | null][] = [
          [record('WBA8E9G50GNT11111', 'BMW', 'HOOK1', vehicle.id), VISITOR],
          [record('WBAUK51070VA22222', 'BMW', 'UK51'), VISITOR],
          [record('WBA8E9G50GNT11111', 'BMW', 'HOOK1', vehicle.id), VISITOR],
          [record('WBAZZ99070VA33333', 'BMW', 'ZZ99'), VISITOR],
          [record('WBAZZ98070VA44444', 'BMW', 'ZZ98'), VISITOR],
          [record('WBAZZ97070VA55555', 'BMW', 'ZZ97'), STRANGER],
          [record('WBAZZ96070VA66666', 'BMW', 'ZZ96'), null],
        ];
        for (const [lookup, visitorId] of saves) {
          await vinLookups.saveLookup(lookup, site(visitorId));
        }
      });

      afterAll(() => {
        delete process.env.SHOP_VISITOR_SEARCHES_SECRET;
        delete process.env.SHOP_LEAD_SECRET;
      });

      it('gives the last three cars the visitor searched, newest first, one per VIN', async () => {
        const response = await lookupsOf(VISITOR);

        expect(response.status).toBe(200);
        expect(response.data).toEqual({
          lookups: [
            {
              make: 'BMW',
              model: 'ZZ98',
              vin_last4: '4444',
              at: expect.any(String),
              vehicle: null,
            },
            {
              make: 'BMW',
              model: 'ZZ99',
              vin_last4: '3333',
              at: expect.any(String),
              vehicle: null,
            },
            {
              make: 'BMW',
              model: '3 серия F30 320d',
              vin_last4: '1111',
              at: expect.any(String),
              vehicle: 'BMW 3 серия F30 320d, B47D20O0',
            },
          ],
        });
        const [newest, , oldest] = response.data.lookups;
        expect(Date.parse(newest.at)).toBeGreaterThan(Date.parse(oldest.at));
      });

      it('names an unresolved car by its open-data model and chassis', async () => {
        const vinLookups: VinLookupModuleService =
          getContainer().resolve(VIN_LOOKUP_MODULE);
        const visitor = '2d0c6b7a-8e3f-4a4b-9c5d-9e0f1a2b3c4d';
        await vinLookups.saveLookup(
          record('WBAUK51070VA77777', 'BMW', 'UK51'),
          site(visitor),
        );

        const response = await lookupsOf(visitor);

        expect(response.data.lookups).toEqual([
          expect.objectContaining({
            make: 'BMW',
            model: '116d E81',
            vin_last4: '7777',
          }),
        ]);
      });

      it('knows nothing of a visitor who never searched', async () => {
        const response = await lookupsOf(
          '3e1d7c8b-9f4a-4b5c-8d6e-0f1a2b3c4d5e',
        );

        expect(response.data).toEqual({ lookups: [] });
      });

      it('refuses a visitor id that is not one', async () => {
        const response = await lookupsOf('not-a-visitor');

        expect(response.status).toBe(400);
      });

      it.each([
        ['no secret', {}],
        ['a wrong secret', { authorization: 'Bearer wrong' }],
        ['the shop lead secret', { authorization: 'Bearer shop-lead-secret' }],
      ])('refuses a request carrying %s', async (_name, headers) => {
        const response = await lookupsOf(VISITOR, { headers });

        expect(response.status).toBe(401);
      });

      it('refuses a staff session, which is not the site', async () => {
        const adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@visitor-lookups.local',
          'supersecret',
        );

        const response = await lookupsOf(VISITOR, adminHeaders);

        expect(response.status).toBe(401);
      });
    });
  },
});
