import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATALOGUE_LOCALE_HEADER,
  IN_STOCK_FACET,
  categoryPagePath,
  categoryPageResponseSchema,
  type CategoryPageResponse,
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

const LISTED = 50;

medusaIntegrationTestRunner({
  moduleName: 'catalogue-category-page',
  dbName: 'carlab_catalogue_category_page',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages/categories/:slug', () => {
      let key: string;

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        key = (
          await container
            .resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({
              title: 'catalogue-category-page-tests',
              type: 'publishable',
              created_by: 'test',
            })
        ).token;

        const [mann] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);
        const filters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        await catalog.createCategories({ slug: 'empty', name: 'Пусто' });
        await catalog.createCategoryFields([
          {
            category_id: filters.id,
            key: 'height',
            type: 'number',
            unit: 'mm',
            label: 'Высота',
          },
          {
            category_id: filters.id,
            key: 'kind',
            type: 'single-select',
            label: 'Тип',
          },
        ]);
        const kind = (
          await catalog.listCategoryFields({ category_id: filters.id })
        ).find(({ key: own }) => own === 'kind')!;
        await catalog.updateCategoryFields({ id: kind.id, facet: true });
        await catalog.createCategoryFieldOptions([
          { field_id: kind.id, key: 'spin-on', label: 'Накручиваемый' },
        ]);

        const parts: string[] = [];
        for (let index = 0; index < LISTED; index += 1) {
          parts.push(
            await catalog.createPartWithIdentifiers({
              name: `Фильтр ${index}`,
              category_id: filters.id,
              attributes: { height: 50 + index, kind: 'spin-on' },
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
        await catalog.updateParts({
          id: parts[0],
          translations: { sr: { name: 'Filter ulja' } },
        });
        const retired = await catalog.createPartWithIdentifiers({
          name: 'Старый фильтр',
          category_id: filters.id,
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'OLD 1' },
          ],
        });
        await catalog.updateParts({ id: retired, replaced_by_id: parts[0] });
        const hidden = await catalog.createPartWithIdentifiers({
          name: 'Скрытый фильтр',
          category_id: filters.id,
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'HID 1' },
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
        await catalog.createFitments([
          ...parts.slice(0, 3).map((part_id) => ({
            part_id,
            vehicle_id: big.vehicle.id,
          })),
          { part_id: parts[3], vehicle_id: small.vehicle.id },
        ]);

        const [first] = await catalog.listPartIdentifiers({
          normalized_value: 'W000',
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
          supplier_article_id: 'S-W000',
          cost_price: 1000,
          stock_quantity: 4,
          lead_time_days: 1,
          part_identifier_id: first.id,
        });

        const publish: PublishModuleService = container.resolve(PUBLISH_MODULE);
        await publish.publishAll();
        const [hiddenNumber] = await catalog.listPartIdentifiers({
          part_id: hidden,
        });
        await publish.unpublish([hiddenNumber.id]);
      });

      const get = (
        slug: string,
        page: number | string,
        headers: Record<string, string> = {},
      ) =>
        api
          .get(`${categoryPagePath(slug).split('?')[0]}?page=${page}`, {
            headers: { 'x-publishable-api-key': key, ...headers },
          })
          .catch((error) => error.response);

      const answer = async (
        slug: string,
        page: number | string = 1,
        headers?: Record<string, string>,
      ): Promise<CategoryPageResponse> => {
        const response = await get(slug, page, headers);
        expect(response.status).toBe(200);
        return categoryPageResponseSchema.parse(response.data);
      };

      it('answers the first page with the page size, the count and the page rules', async () => {
        const first = await answer('oil-filters');

        expect(first).toMatchObject({
          page: 1,
          pages: 2,
          count: LISTED,
          category: { slug: 'oil-filters' },
        });
        expect(first.entries).toHaveLength(48);
        expect(first.entries[0].slug).toBe('mann-filter-w000');
        expect(first.entries.map(({ slug }) => slug)).not.toContain(
          'mann-filter-old1',
        );
        expect(first.entries.map(({ slug }) => slug)).not.toContain(
          'mann-filter-hid1',
        );
      });

      it('continues on the second page and answers 404 past the last', async () => {
        const second = await answer('oil-filters', 2);

        expect(second.entries.map(({ slug }) => slug)).toEqual([
          'mann-filter-w048',
          'mann-filter-w049',
        ]);
        expect(second.popular).toEqual([]);
        expect((await get('oil-filters', 3)).status).toBe(404);
        expect((await get('oil-filters', 0)).status).toBe(404);
        expect((await get('oil-filters', 'two')).status).toBe(404);
      });

      it('answers 404 for an unknown Category', async () => {
        expect((await get('nothing', 1)).status).toBe(404);
      });

      it('answers an empty Category with one empty page', async () => {
        const empty = await answer('empty');

        expect(empty).toMatchObject({
          page: 1,
          pages: 1,
          count: 0,
          entries: [],
          cars: [],
          facets: [],
        });
        expect((await get('empty', 2)).status).toBe(404);
      });

      it('describes the whole Category, not only the page', async () => {
        const { facets, ranges, uniform, demanded } = await answer(
          'oil-filters',
          2,
        );

        expect(ranges).toEqual([{ key: 'height', min: 50, max: 99 }]);
        expect(uniform).toEqual(['kind']);
        expect(demanded).toBe(false);
        expect(
          facets.map(({ key: own, values }) => [own, values[0].count]),
        ).toEqual([[IN_STOCK_FACET, 1]]);
      });

      it('offers only the series that have a page in the Category', async () => {
        const { cars } = await answer('oil-filters');

        expect(cars).toEqual([
          {
            make: { slug: 'bmw', name: 'BMW' },
            series: [
              {
                slug: seriesSlugOf('3 серия'),
                name: '3 серия',
                translations: null,
              },
            ],
          },
        ]);
      });

      it('picks the translation the locale header names', async () => {
        const { entries } = await answer('oil-filters', 1, {
          [CATALOGUE_LOCALE_HEADER]: 'sr',
        });

        expect(entries[0].part.name).toBe('Filter ulja');
      });

      it('names the Category and the series in the locale of the header', async () => {
        const { category, cars } = await answer('oil-filters', 1, {
          [CATALOGUE_LOCALE_HEADER]: 'sr',
        });

        expect(category.translations).toBeNull();
        expect(cars[0].series[0]).toMatchObject({
          name: 'Serija 3',
          translations: null,
        });
      });

      it('shows prices only with the preview header while the shop is closed', async () => {
        process.env.SHOP_OPEN = 'false';
        const anonymous = await answer('oil-filters');
        const previewed = await answer('oil-filters', 1, {
          [SHOP_PREVIEW_HEADER]: process.env.SHOP_PREVIEW_TOKEN!,
        });

        delete process.env.SHOP_OPEN;

        expect(anonymous.entries[0].offers).toEqual([]);
        expect(previewed.entries[0].offers.map(({ price }) => price)).toEqual([
          1200,
        ]);
      });
    });
  },
});
