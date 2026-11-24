import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATALOGUE_LOCALE_HEADER,
  seriesCategoryPagePath,
  seriesCategoryPageResponseSchema,
  seriesPagePath,
  seriesPageResponseSchema,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { createVehicleFixture } from '../../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../../modules/publish';
import type PublishModuleService from '../../../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';

const SERIES = seriesSlugOf('3 серия');

medusaIntegrationTestRunner({
  moduleName: 'catalogue-series-page',
  dbName: 'carlab_catalogue_series_page',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages/series/:make/:series', () => {
      let key: string;
      let bigVehicle: string;

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        key = (
          await container
            .resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({
              title: 'catalogue-series-page-tests',
              type: 'publishable',
              created_by: 'test',
            })
        ).token;

        const [mann, bmw] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'BMW', slug: 'bmw' },
        ]);
        const filters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const brakes = await catalog.createCategories({
          slug: 'brake-pads',
          name: 'Колодки',
        });
        const filter = (value: string) =>
          catalog.createPartWithIdentifiers({
            name: `Filter ${value}`,
            category_id: filters.id,
            identifiers: [
              { type: 'manufacturer-number', brand_id: mann.id, value },
            ],
          });

        const oilFilter = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          category_id: filters.id,
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
            { type: 'oem', brand_id: bmw.id, value: '11 42 8575211' },
          ],
        });
        await catalog.updateParts({
          id: oilFilter,
          translations: { sr: { name: 'Filter ulja' } },
        });
        const others = [await filter('W 1'), await filter('W 2')];
        const hidden = await filter('HU 9');
        const pad = await catalog.createPartWithIdentifiers({
          name: 'Колодка',
          category_id: brakes.id,
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'P 1' },
          ],
        });

        const big = await createVehicleFixture(catalog);
        const small = await createVehicleFixture(catalog, {
          make: { slug: 'tiny', name: 'Tiny' },
          typeCode: 'T1',
          seriesName: 'Small',
          modelSlug: 'small-1',
          chassisCode: 'S1',
          engineCode: 'S1E',
        });
        bigVehicle = big.vehicle.id;
        await catalog.createFitments([
          ...[oilFilter, ...others, pad].map((part_id) => ({
            part_id,
            vehicle_id: big.vehicle.id,
          })),
          { part_id: oilFilter, vehicle_id: small.vehicle.id },
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
          .get(path, {
            headers: { 'x-publishable-api-key': key, ...headers },
          })
          .catch((error) => error.response);

      const hub = async (headers?: Record<string, string>) => {
        const response = await get(seriesPagePath('bmw', SERIES), headers);
        expect(response.status).toBe(200);
        return seriesPageResponseSchema.parse(response.data);
      };

      const categoryPage = async (headers?: Record<string, string>) => {
        const response = await get(
          seriesCategoryPagePath('bmw', SERIES, 'oil-filters'),
          headers,
        );
        expect(response.status).toBe(200);
        return seriesCategoryPageResponseSchema.parse(response.data);
      };

      it('answers the hub with the Series, its modifications and the Categories that have a page', async () => {
        const page = await hub();

        expect(page.series).toMatchObject({
          slug: SERIES,
          name: '3 серия',
          make: { slug: 'bmw' },
        });
        expect(page.models.map(({ vehicles }) => vehicles[0].id)).toEqual([
          bigVehicle,
        ]);
        expect(page.categories.map(({ slug }) => slug)).toEqual([
          'oil-filters',
        ]);
        expect(page.popular).toEqual([]);
      });

      it('answers 404 below the page rules and for an unknown place', async () => {
        for (const path of [
          seriesPagePath('tiny', seriesSlugOf('Small')),
          seriesPagePath('bmw', 'nothing'),
          seriesPagePath('nothing', SERIES),
          seriesCategoryPagePath('tiny', seriesSlugOf('Small'), 'oil-filters'),
          seriesCategoryPagePath('bmw', SERIES, 'brake-pads'),
          seriesCategoryPagePath('bmw', SERIES, 'nothing'),
        ]) {
          expect((await get(path)).status).toBe(404);
        }
      });

      it('lists the published parts of the Category with every number and the fits in the Series', async () => {
        const page = await categoryPage();

        expect(page.category.slug).toBe('oil-filters');
        expect(page.parts).toHaveLength(3);
        const filterPart = page.parts.find(({ pages }) =>
          pages.some(({ slug }) => slug === 'mann-filter-hu816x'),
        )!;
        expect(filterPart.pages.map(({ slug }) => slug).sort()).toEqual([
          'bmw-11428575211',
          'mann-filter-hu816x',
        ]);
        expect(filterPart.fits.map(({ vehicle }) => vehicle.id)).toEqual([
          bigVehicle,
        ]);
        expect(
          page.parts.flatMap(({ pages }) => pages.map(({ slug }) => slug)),
        ).not.toContain('mann-filter-hu9');
      });

      it('picks the translation the locale header names', async () => {
        const page = await categoryPage({ [CATALOGUE_LOCALE_HEADER]: 'sr' });

        expect(
          page.parts.flatMap(({ pages }) => pages.map(({ part }) => part.name)),
        ).toContain('Filter ulja');
      });

      it('shows prices only with the preview header while the shop is closed', async () => {
        process.env.SHOP_OPEN = 'false';
        const prices = async (headers?: Record<string, string>) =>
          (await categoryPage(headers)).parts
            .flatMap(({ pages }) => pages)
            .flatMap(({ offers }) => offers.map(({ price }) => price));
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
