import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATALOGUE_LOCALE_HEADER,
  carMakePagePath,
  carMakePageResponseSchema,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';

import { createVehicleFixture } from '../../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../../modules/publish';
import type PublishModuleService from '../../../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-car-make-page',
  dbName: 'carlab_catalogue_car_make_page',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages/cars/:make', () => {
      let key: string;

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        key = (
          await container
            .resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({
              title: 'catalogue-car-make-page-tests',
              type: 'publishable',
              created_by: 'test',
            })
        ).token;
        const mann = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const filters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        await catalog.updateCategories({
          id: filters.id,
          translations: { sr: { name: 'Filteri ulja' } },
        });
        const filter = (value: string) =>
          catalog.createPartWithIdentifiers({
            name: `Filter ${value}`,
            category_id: filters.id,
            identifiers: [
              { type: 'manufacturer-number', brand_id: mann.id, value },
            ],
          });
        const parts = [
          await filter('HU 816 x'),
          await filter('W 1'),
          await filter('W 2'),
        ];
        const hidden = await filter('HU 9');
        const big = await createVehicleFixture(catalog);
        const small = await createVehicleFixture(catalog, {
          make: { slug: 'tiny', name: 'Tiny' },
          typeCode: 'T1',
          seriesName: 'Small',
          modelSlug: 'small-1',
          chassisCode: 'S1',
          engineCode: 'S1E',
        });
        await catalog.createFitments([
          ...parts.map((part_id) => ({ part_id, vehicle_id: big.vehicle.id })),
          { part_id: hidden, vehicle_id: big.vehicle.id },
          { part_id: parts[0], vehicle_id: small.vehicle.id },
        ]);
        const [mannOil] = await catalog.listPartIdentifiers({
          normalized_value: 'HU816X',
        });
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const supplier = await suppliers.createSuppliers({
          key: 'demo-intercars',
          name: 'Supplier',
          markup_percentage: 20,
        });
        await suppliers.createSupplierOffers({
          supplier_id: supplier.id,
          supplier_article_id: 'S-HU816X',
          cost_price: 1000,
          stock_quantity: 4,
          lead_time_days: 1,
          part_identifier_id: mannOil.id,
        });
        const publish: PublishModuleService = container.resolve(PUBLISH_MODULE);
        await publish.publishAll();
        const [hiddenNumber] = await catalog.listPartIdentifiers({
          part_id: hidden,
        });
        await publish.unpublish([hiddenNumber.id]);
      });

      const get = (path: string, headers: Record<string, string> = {}) =>
        api
          .get(path, { headers: { 'x-publishable-api-key': key, ...headers } })
          .catch((error) => error.response);

      const answer = async (make: string, headers?: Record<string, string>) => {
        const response = await get(carMakePagePath(make), headers);
        expect(response.status).toBe(200);
        return carMakePageResponseSchema.parse(response.data);
      };

      const slugs = (page: Awaited<ReturnType<typeof answer>>) =>
        page.showcase.map(({ slug }) => slug);

      it('answers the Categories of the Make with the published Parts only', async () => {
        const page = await answer('bmw');

        expect(page.categories.map(({ slug }) => slug)).toEqual([
          'oil-filters',
        ]);
        expect(slugs(page)).toEqual(
          expect.arrayContaining(['mann-filter-hu816x', 'mann-filter-w1']),
        );
        expect(slugs(page)).not.toContain('mann-filter-hu9');
      });

      it('says whether the Make has a hub', async () => {
        expect((await answer('bmw')).hub).toBe(true);
        expect((await answer('tiny')).hub).toBe(false);
      });

      it('picks the translation the locale header names', async () => {
        const page = await answer('bmw', { [CATALOGUE_LOCALE_HEADER]: 'sr' });

        expect(page.categories[0].translations).toMatchObject({
          sr: { name: 'Filteri ulja' },
        });
      });

      it('ranks every Part of a Category before it caps the showcase', async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const publish: PublishModuleService = container.resolve(PUBLISH_MODULE);
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        const [belts] = await catalog.listCategories({ slug: 'oil-filters' });
        const queued = await createVehicleFixture(catalog, {
          make: { slug: 'queue', name: 'Queue' },
          typeCode: 'Q1',
          seriesName: 'Queue series',
          modelSlug: 'queue-1',
          chassisCode: 'Q1C',
          engineCode: 'Q1E',
        });
        const ids: string[] = [];
        for (let index = 0; index < 14; index += 1) {
          ids.push(
            await catalog.createPartWithIdentifiers({
              name: `Queue ${index}`,
              category_id: belts.id,
              identifiers: [
                {
                  type: 'manufacturer-number',
                  brand_id: mann.id,
                  value: `QQ ${100 + index}`,
                },
              ],
            }),
          );
        }
        await catalog.createFitments(
          ids.map((part_id) => ({ part_id, vehicle_id: queued.vehicle.id })),
        );
        const [last] = await catalog.listPartIdentifiers({
          normalized_value: 'QQ113',
        });
        const [supplier] = await suppliers.listSuppliers({
          key: 'demo-intercars',
        });
        await suppliers.createSupplierOffers({
          supplier_id: supplier.id,
          supplier_article_id: 'S-QQ113',
          cost_price: 1000,
          stock_quantity: 4,
          lead_time_days: 1,
          part_identifier_id: last.id,
        });
        await publish.publishAll();

        expect(slugs(await answer('queue'))).toContain('mann-filter-qq113');
      });

      it('answers 404 for a Make with nothing listed and for an unknown Make', async () => {
        expect((await get(carMakePagePath('nothing'))).status).toBe(404);
      });

      it('shows prices only with the preview header while the shop is closed', async () => {
        process.env.SHOP_OPEN = 'false';
        const prices = async (headers?: Record<string, string>) =>
          (await answer('bmw', headers)).showcase.flatMap(({ offers }) =>
            offers.map(({ price }) => price),
          );
        const anonymous = await prices();
        const previewed = await prices({
          [SHOP_PREVIEW_HEADER]: process.env.SHOP_PREVIEW_TOKEN!,
        });

        delete process.env.SHOP_OPEN;

        expect(anonymous).toEqual([]);
        expect(previewed).toEqual([1200]);
      });
    });
  },
});
