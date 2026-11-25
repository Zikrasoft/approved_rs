import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  categoryPagePath,
  categoryPageResponseSchema,
  seriesCategoryPagePath,
  seriesPagePath,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { refreshPartDemandAt } from '../../../../jobs/refresh-part-demand';
import { clearCatalogueMemo } from '../../../../lib/catalogue-memo';
import { warmCatalogueMemo } from '../../../../lib/catalogue-page-list';
import { reindexSupplierOffers } from '../../../../lib/suppliers/markup-reindex';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const SERIES = seriesSlugOf('3 серия');
const LISTED = 50;

const AGGREGATES = [
  'listedNumbersIn',
  'listedSeriesCategoryCounts',
  'listedVehicleParts',
  'listedMakePartCounts',
] as const;

medusaIntegrationTestRunner({
  moduleName: 'catalogue-memo',
  dbName: 'carlab_catalogue_memo',
  testSuite: ({ api, getContainer }) => {
    describe('the catalogue memo behind the catalogue-pages endpoints', () => {
      let key: string;
      let parts: string[];
      let supplierId: string;
      const catalog = () =>
        getContainer().resolve<CatalogModuleService>(CATALOG_MODULE);
      const publish = () =>
        getContainer().resolve<PublishModuleService>(PUBLISH_MODULE);

      beforeAll(async () => {
        const container = getContainer();
        key = (
          await container
            .resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({
              title: 'catalogue-memo-tests',
              type: 'publishable',
              created_by: 'test',
            })
        ).token;
        const [mann] = await catalog().createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);
        const filters = await catalog().createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        await catalog().createCategoryFields([
          {
            category_id: filters.id,
            key: 'height',
            type: 'number',
            unit: 'mm',
            label: 'Высота',
          },
        ]);
        parts = [];
        for (let index = 0; index < LISTED; index += 1) {
          parts.push(
            await catalog().createPartWithIdentifiers({
              name: `Фильтр ${index}`,
              category_id: filters.id,
              attributes: { height: 50 + index },
              identifiers: [
                {
                  type: 'manufacturer-number',
                  brand_id: mann.id,
                  value: `W ${String(index).padStart(3, '0')}`,
                },
              ],
            }),
          );
        }
        const { vehicle } = await createVehicleFixture(catalog());
        await catalog().createFitments(
          parts
            .slice(0, 3)
            .map((part_id) => ({ part_id, vehicle_id: vehicle.id })),
        );
        const [first] = await catalog().listPartIdentifiers({
          normalized_value: 'W000',
        });
        const suppliers =
          container.resolve<SupplierModuleService>(SUPPLIER_MODULE);
        const supplier = await suppliers.createSuppliers({
          key: 'demo-intercars',
          name: 'Supplier',
          markup_percentage: 20,
        });
        supplierId = supplier.id;
        await suppliers.createSupplierOffers({
          supplier_id: supplier.id,
          supplier_article_id: 'S-W000',
          cost_price: 1000,
          stock_quantity: 4,
          lead_time_days: 1,
          part_identifier_id: first.id,
        });
        await publish().publishAll();
      });

      afterEach(() => jest.restoreAllMocks());

      const get = async (path: string) => {
        const response = await api
          .get(path, { headers: { 'x-publishable-api-key': key } })
          .catch((error) => error.response);
        expect(response.status).toBe(200);
        return response.data;
      };

      const categoryPage = (page: number) =>
        get(`${categoryPagePath('oil-filters').split('?')[0]}?page=${page}`);

      const bodies = async () => ({
        first: await categoryPage(1),
        second: await categoryPage(2),
        series: await get(seriesPagePath('bmw', SERIES)),
        seriesCategory: await get(
          seriesCategoryPagePath('bmw', SERIES, 'oil-filters'),
        ),
        list: await get('/store/catalogue-pages'),
      });

      const aggregateCalls = () => {
        const service = publish();
        return AGGREGATES.map((name) => jest.spyOn(service, name));
      };

      const publishAll = async () => {
        await publish().publishAll();
        clearCatalogueMemo();
      };

      const lowestHeight = async () =>
        categoryPageResponseSchema
          .parse(await categoryPage(1))
          .ranges.find(({ key: own }) => own === 'height')?.min;

      const changeLowestHeight = (height: number) =>
        catalog().updateParts({ id: parts[0], attributes: { height } });

      it('answers the same bodies cold and warm', async () => {
        await publishAll();
        const cold = await bodies();

        await warmCatalogueMemo(getContainer());

        expect(await bodies()).toEqual(cold);
        expect(cold.list.categories).toEqual([
          expect.objectContaining({ slug: 'oil-filters', listed: LISTED }),
        ]);
        expect(cold.second.entries).toHaveLength(LISTED - 48);
      });

      it('runs no aggregate SQL again for a second Category page 2 and a second series page', async () => {
        await publishAll();
        await categoryPage(2);
        await get(seriesPagePath('bmw', SERIES));
        const calls = aggregateCalls();

        await categoryPage(2);
        await get(seriesPagePath('bmw', SERIES));

        calls.forEach((call) => expect(call).not.toHaveBeenCalled());
      });

      it('reflects the database after a demand refresh', async () => {
        await changeLowestHeight(50);
        await publishAll();
        expect(await lowestHeight()).toBe(50);
        await changeLowestHeight(10);
        expect(await lowestHeight()).toBe(50);

        await refreshPartDemandAt(getContainer(), new Date());

        expect(await lowestHeight()).toBe(10);
      });

      it('reflects the database after a supplier markup reindex', async () => {
        await changeLowestHeight(50);
        await publishAll();
        expect(await lowestHeight()).toBe(50);
        await changeLowestHeight(20);

        await reindexSupplierOffers(getContainer(), supplierId);

        expect(await lowestHeight()).toBe(20);
      });

      it('leaves the old memo behind once a new Publish run starts', async () => {
        await changeLowestHeight(50);
        await publishAll();
        expect(await lowestHeight()).toBe(50);
        await changeLowestHeight(30);

        await publish().createCatalogueRuns({
          kind: 'publish',
          status: 'succeeded',
          heartbeat_at: new Date(),
          finished_at: new Date(),
        });

        expect(await lowestHeight()).toBe(30);
      });
    });
  },
});
