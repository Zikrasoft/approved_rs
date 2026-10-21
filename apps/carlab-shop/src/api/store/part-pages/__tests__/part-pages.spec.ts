import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'part-pages',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/part-pages', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let oilFilters: { id: string };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'part-pages-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [bmw, mann] = await catalog.createBrands([
          { name: 'BMW', slug: 'bmw' },
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);
        oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        await catalog.createCategoryFields({
          category_id: oilFilters.id,
          key: 'height',
          type: 'number',
          unit: 'mm',
          label: 'Высота',
        });
        const oilFilterId = await catalog.createPartWithIdentifiers({
          name: 'Oil filter, BMW B47/B48 engines',
          category_id: oilFilters.id,
          attributes: { height: 75 },
          identifiers: [
            { type: 'oem', brand_id: bmw.id, value: '11 42 8575211' },
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
        });
        await catalog.updateParts({
          id: oilFilterId,
          translations: { sr: { name: 'Filter ulja, BMW B47/B48' } },
        });
        await catalog.createPartWithIdentifiers({
          name: 'Cabin filter',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'CUK 2939',
            },
          ],
        });
      });

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const [mannOil] = await catalog.listPartIdentifiers({
          normalized_value: 'HU816X',
        });
        const supplier = await suppliers.createSuppliers({
          name: 'Intercars',
          markup_percentage: 20,
        });
        await suppliers.createSupplierOffers({
          supplier_id: supplier.id,
          supplier_article_id: 'IC-HU816X',
          cost_price: 1000,
          stock_quantity: 4,
          lead_time_days: 1,
          part_identifier_id: mannOil.id,
        });
      });

      const get = (query = '') =>
        api
          .get(`/store/part-pages${query}`, storeHeaders)
          .catch((error) => error.response);

      it('lists a page per brand-number with its equivalents in the same Part', async () => {
        const response = await get();

        expect(response.status).toBe(200);
        expect(response.data.count).toBe(3);
        const mannOil = response.data.pages.find(
          (page: { normalized_value: string }) =>
            page.normalized_value === 'HU816X',
        );
        expect(mannOil).toEqual({
          id: expect.any(String),
          type: 'manufacturer-number',
          value: 'HU 816 x',
          normalized_value: 'HU816X',
          superseded: false,
          brand: { name: 'Mann-Filter', slug: 'mann-filter' },
          part: {
            id: expect.any(String),
            name: 'Oil filter, BMW B47/B48 engines',
            translations: { sr: { name: 'Filter ulja, BMW B47/B48' } },
            replaced_by: null,
            category_id: oilFilters.id,
            attributes: { height: 75 },
          },
          equivalents: [
            {
              id: expect.any(String),
              type: 'oem',
              value: '11 42 8575211',
              normalized_value: '11428575211',
              superseded: false,
              brand: { name: 'BMW', slug: 'bmw' },
            },
          ],
          offers: [
            {
              id: expect.any(String),
              price: 1200,
              currency: 'RSD',
              stock_quantity: 4,
              lead_time_days: 1,
            },
          ],
          supplier_data: {
            cross_references: [],
            applicability: [],
            images: [],
          },
        });
        const cabin = response.data.pages.find(
          (page: { normalized_value: string }) =>
            page.normalized_value === 'CUK2939',
        );
        expect(cabin.equivalents).toEqual([]);
        expect(cabin.part).toMatchObject({
          translations: null,
          category_id: null,
          attributes: {},
        });
        expect(cabin.offers).toEqual([]);
      });

      it('pages through the list', async () => {
        const first = await get('?limit=2');
        const second = await get('?limit=2&offset=2');

        expect(first.data).toMatchObject({ count: 3, offset: 0, limit: 2 });
        expect(first.data.pages).toHaveLength(2);
        expect(second.data.pages).toHaveLength(1);
        const ids = [...first.data.pages, ...second.data.pages].map(
          (page: { id: string }) => page.id,
        );
        expect(new Set(ids).size).toBe(3);
      });

      it.each(['?limit=0', '?limit=5001', '?offset=-1', '?limit=abc'])(
        'returns a 400 for %s',
        async (query) => {
          expect((await get(query)).status).toBe(400);
        },
      );
    });
  },
});
