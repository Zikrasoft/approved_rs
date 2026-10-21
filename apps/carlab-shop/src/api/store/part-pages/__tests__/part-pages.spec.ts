import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/part-pages', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

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
        await catalog.createPartWithIdentifiers({
          name: 'Oil filter, BMW B47/B48 engines',
          identifiers: [
            { type: 'oem', brand_id: bmw.id, value: '11 42 8575211' },
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
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
            replaced_by: null,
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
        });
        const cabin = response.data.pages.find(
          (page: { normalized_value: string }) =>
            page.normalized_value === 'CUK2939',
        );
        expect(cabin.equivalents).toEqual([]);
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
