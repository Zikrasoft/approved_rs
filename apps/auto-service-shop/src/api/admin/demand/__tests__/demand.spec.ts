import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { DEMAND_MODULE } from '../../../../modules/demand';
import type DemandModuleService from '../../../../modules/demand/service';

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

medusaIntegrationTestRunner({
  moduleName: 'admin-demand',
  dbName: 'medusa-admin-demand-integration',
  testSuite: ({ api, getContainer }) => {
    describe('GET /admin/demand', () => {
      let adminHeaders: { headers: { authorization: string } };
      const number: Record<string, string> = {};

      const report = (query = '') =>
        api
          .get(`/admin/demand${query}`, adminHeaders)
          .catch((error) => error.response);

      beforeAll(async () => {
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'demand@carlab.local',
          'secret-password',
        );
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const demand: DemandModuleService =
          getContainer().resolve(DEMAND_MODULE);
        const [mann] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);
        const oil = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const { vehicle } = await createVehicleFixture(catalog);
        const partOf = async (value: string, category_id?: string) => {
          const id = await catalog.createPartWithIdentifiers({
            name: `Фильтр ${value}`,
            ...(category_id && { category_id }),
            identifiers: [
              { type: 'manufacturer-number', brand_id: mann.id, value },
            ],
          });
          [{ id: number[value] }] = await catalog.listPartIdentifiers({
            part_id: id,
          });
          return id;
        };
        const fitted = await partOf('HU 816 x', oil.id);
        await partOf('W 712', oil.id);
        await partOf('CUK 2939');
        await catalog.createFitments({
          part_id: fitted,
          vehicle_id: vehicle.id,
        });

        await demand.record({
          signal: 'order',
          identifierIds: [number['HU 816 x']],
        });
        await demand.record({
          signal: 'inquiry',
          identifierIds: [number['HU 816 x'], number['W 712']],
        });
        await demand.record({
          signal: 'pick',
          identifierIds: [number['CUK 2939']],
          at: daysAgo(20),
        });
        await demand.record({ signal: 'order', identifierIds: ['pi_deleted'] });
        await demand.recordMissedQuery('exide ea770');
        await demand.recordMissedQuery('exide ea770');
        await demand.recordMissedQuery('k&n 33-2304', daysAgo(20));
      });

      it('ranks the numbers still in the catalogue, their Categories, cars and empty queries of the last 30 days by default', async () => {
        const response = await report();

        expect(response.status).toBe(200);
        expect(response.data).toEqual({
          days: 30,
          parts: [
            {
              id: number['HU 816 x'],
              brand: 'Mann-Filter',
              number: 'HU 816 x',
              name: 'Фильтр HU 816 x',
              category: 'Масляные фильтры',
              orders: 1,
              inquiries: 1,
              picks: 0,
              score: 8,
            },
            expect.objectContaining({ number: 'W 712', score: 3 }),
            expect.objectContaining({
              number: 'CUK 2939',
              category: null,
              score: 1,
            }),
          ],
          categories: [
            {
              name: 'Масляные фильтры',
              orders: 1,
              inquiries: 2,
              picks: 0,
              score: 11,
            },
          ],
          cars: [{ make: 'BMW', series: '3 серия', model: '320d', score: 8 }],
          missed_queries: [
            { query: 'exide ea770', count: 2 },
            { query: 'k&n 33-2304', count: 1 },
          ],
        });
      });

      it('narrows to the last 7 days', async () => {
        const response = await report('?days=7');

        expect(response.data.days).toBe(7);
        expect(
          response.data.parts.map(
            ({ number: value }: { number: string }) => value,
          ),
        ).toEqual(['HU 816 x', 'W 712']);
        expect(response.data.missed_queries).toEqual([
          { query: 'exide ea770', count: 2 },
        ]);
      });

      it.each(['?days=14', '?days=abc'])('refuses %s', async (query) => {
        expect((await report(query)).status).toBe(400);
      });

      it('answers only an admin', async () => {
        const response = await api
          .get('/admin/demand')
          .catch((error) => error.response);
        expect(response.status).toBe(401);
      });
    });
  },
});
