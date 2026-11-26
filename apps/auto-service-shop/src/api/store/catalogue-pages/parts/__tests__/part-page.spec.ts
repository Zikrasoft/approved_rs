import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATALOGUE_LOCALE_HEADER,
  partPagePath,
  partPageResponseSchema,
  type PartPageResponse,
  type Vehicle,
} from '@podbor/catalog-contract';
import { SHOP_PREVIEW_HEADER } from '@podbor/catalog-contract/preview';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { clearCatalogueMemo } from '../../../../../lib/catalogue-memo';
import { createVehicleFixture } from '../../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../../modules/publish';
import type PublishModuleService from '../../../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import type SupplierModuleService from '../../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-part-page',
  dbName: 'carlab_catalogue_part_page',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages/parts/:slug', () => {
      let key: string;
      let vehicles: Record<'big' | 'small' | 'required', string>;

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        key = (
          await container
            .resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({
              title: 'catalogue-part-page-tests',
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
          maintenance_kit: true,
        });
        const height = await catalog.createCategoryFields({
          category_id: filters.id,
          key: 'height',
          type: 'number',
          unit: 'mm',
          label: 'Высота',
        });
        const filter = (value: string, heightMm: number) =>
          catalog.createPartWithIdentifiers({
            name: `Filter ${value}`,
            category_id: filters.id,
            attributes: { height: heightMm },
            identifiers: [
              { type: 'manufacturer-number', brand_id: mann.id, value },
            ],
          });

        const oilFilter = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          category_id: filters.id,
          attributes: { height: 75 },
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
        const others = [await filter('W 1', 50), await filter('W 2', 50)];
        const retired = await catalog.createPartWithIdentifiers({
          name: 'Старый фильтр',
          category_id: filters.id,
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'HU 1' },
          ],
        });
        await catalog.updateParts({ id: retired, replaced_by_id: oilFilter });
        const hidden = await filter('HU 9', 75);

        const big = await createVehicleFixture(catalog);
        const small = await createVehicleFixture(catalog, {
          make: { slug: 'tiny', name: 'Tiny' },
          typeCode: 'T1',
          seriesName: 'Small',
          modelSlug: 'small-1',
          chassisCode: 'S1',
          engineCode: 'S1E',
        });
        const required = await createVehicleFixture(catalog, {
          make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
          identifierType: 'mercedes-baumuster',
          typeCode: '213004',
          seriesName: 'E',
          modelSlug: 'w213-e220d',
          chassisCode: 'W213',
          engineCode: 'OM654D20',
        });
        vehicles = {
          big: big.vehicle.id,
          small: small.vehicle.id,
          required: required.vehicle.id,
        };
        await catalog.createRequirements([
          { field_id: height.id, vehicle_id: required.vehicle.id, min: 70 },
        ]);
        await catalog.createFitments([
          ...[oilFilter, ...others].map((part_id) => ({
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
        await publish.buildCatalogueSnapshot();
      });

      const get = (slug: string, headers: Record<string, string> = {}) =>
        api
          .get(partPagePath(slug), {
            headers: { 'x-publishable-api-key': key, ...headers },
          })
          .catch((error) => error.response);

      const partPage = async (
        slug: string,
        headers?: Record<string, string>,
      ): Promise<PartPageResponse> => {
        const response = await get(slug, headers);
        expect(response.status).toBe(200);
        return partPageResponseSchema.parse(response.data);
      };

      it('answers a published Part with its equivalents, Category and fits', async () => {
        const { page, related } = await partPage('mann-filter-hu816x');

        expect(page).toMatchObject({
          slug: 'mann-filter-hu816x',
          value: 'HU 816 x',
          indexable: true,
          part: { name: 'Масляный фильтр', translations: null },
          category: { slug: 'oil-filters' },
        });
        expect(page.equivalents.map(({ value }) => value)).toEqual([
          '11 42 8575211',
        ]);
        expect(related.map(({ slug }) => slug)).toEqual(['bmw-11428575211']);
        expect(page.fits.map(({ vehicle_id }) => vehicle_id).sort()).toEqual(
          [vehicles.big, vehicles.small].sort(),
        );
      });

      it('answers 404 for an unpublished number and for an unknown slug', async () => {
        expect((await get('mann-filter-hu9')).status).toBe(404);
        expect((await get('mann-filter-nothing1')).status).toBe(404);
        expect((await get('nobrand')).status).toBe(404);
      });

      it('links a series only when the series has a page', async () => {
        const { linked_series } = await partPage('mann-filter-hu816x');

        expect(linked_series).toEqual([
          { make: 'bmw', slug: seriesSlugOf('3 серия') },
        ]);
      });

      it('lists the cars it fits by requirement and the cars whose service kit it is', async () => {
        const { page, vehicles: cars } = await partPage('mann-filter-hu816x');

        expect(page.requirement_cars).toEqual([vehicles.required]);
        expect([...page.kit_cars].sort()).toEqual(
          [vehicles.small, vehicles.required].sort(),
        );
        expect(cars.map(({ id }) => id).sort()).toEqual(
          [vehicles.big, vehicles.small, vehicles.required].sort(),
        );
      });

      it('gives a replaced Part the pages of its replacement', async () => {
        const { page, related } = await partPage('mann-filter-hu1');

        expect(page.part.replaced_by?.name).toBe('Масляный фильтр');
        expect(related.map(({ slug }) => slug).sort()).toEqual([
          'bmw-11428575211',
          'mann-filter-hu816x',
        ]);
        expect(page.requirement_cars).toEqual([]);
        expect(page.kit_cars).toEqual([]);
      });

      it('picks the translation the locale header names', async () => {
        const { page, vehicles } = await partPage('mann-filter-hu816x', {
          [CATALOGUE_LOCALE_HEADER]: 'sr',
        });

        expect(page.part.name).toBe('Filter ulja');
        expect(page.category).toMatchObject({ translations: null });
        expect(
          vehicles.map(({ model }: Vehicle) => model.chassis.series),
        ).toEqual(
          vehicles.map(() =>
            expect.objectContaining({ name: 'Serija 3', translations: null }),
          ),
        );
      });

      it('shows prices only with the preview header while the shop is closed', async () => {
        process.env.SHOP_OPEN = 'false';
        const anonymous = await partPage('mann-filter-hu816x');
        const previewed = await partPage('mann-filter-hu816x', {
          [SHOP_PREVIEW_HEADER]: process.env.SHOP_PREVIEW_TOKEN!,
        });

        delete process.env.SHOP_OPEN;

        expect(anonymous.page.offers).toEqual([]);
        expect(previewed.page.offers.map(({ price }) => price)).toEqual([1200]);
      });

      it('loads vehicles once and serves the kit Part list from the memo on a second call', async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const publish: PublishModuleService = container.resolve(PUBLISH_MODULE);
        clearCatalogueMemo();
        const first = await partPage('mann-filter-hu816x');
        const listedBefore = jest.spyOn(publish, 'listedPartsIn');
        const vehiclesBefore = jest.spyOn(catalog, 'vehicleRows');
        const fitmentsBefore = jest.spyOn(catalog, 'fitmentRows');
        const second = await partPage('mann-filter-hu816x');
        const fitmentFilters = fitmentsBefore.mock.calls.map(([filter]) =>
          Object.keys(filter as object),
        );
        const counts = {
          listed: listedBefore.mock.calls.length,
          vehicleReads: vehiclesBefore.mock.calls.length,
          kitFitments: fitmentFilters.filter(
            (keys) => keys.includes('part_id') && keys.includes('vehicle_id'),
          ).length,
        };
        jest.restoreAllMocks();

        expect(second).toEqual(first);
        expect(counts.listed).toBe(0);
        expect(counts.kitFitments).toBe(1);
        expect(counts.vehicleReads).toBe(3);
      });
    });
  },
});
