import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/categories', () => {
      it('lists Categories with their text, fields and options for the build', async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'categories-tests',
          type: 'publishable',
          created_by: 'test',
        });
        const oil = await catalog.createCategories({
          slug: 'engine-oil',
          name: 'Моторное масло',
          text: 'Масло для двигателя.',
          translations: { sr: { name: 'Motorno ulje' } },
          created_by: 'user_1',
        });
        const [, viscosity] = await catalog.createCategoryFields([
          {
            category_id: oil.id,
            key: 'volume',
            type: 'number',
            unit: 'l',
            label: 'Объем',
            rank: 2,
          },
          {
            category_id: oil.id,
            key: 'viscosity',
            type: 'single-select',
            label: 'Вязкость',
            rank: 1,
            facet: true,
          },
        ]);
        await catalog.createCategoryFieldOptions([
          { field_id: viscosity.id, key: '0w-20', label: '0W-20', rank: 2 },
          { field_id: viscosity.id, key: '5w-30', label: '5W-30', rank: 1 },
        ]);

        const response = await api.get('/store/categories', {
          headers: { 'x-publishable-api-key': key.token },
        });

        expect(response.data).toEqual({
          categories: [
            {
              id: oil.id,
              slug: 'engine-oil',
              name: 'Моторное масло',
              text: 'Масло для двигателя.',
              translations: { sr: { name: 'Motorno ulje' } },
              fields: [
                {
                  key: 'viscosity',
                  type: 'single-select',
                  unit: null,
                  label: 'Вязкость',
                  translations: null,
                  required: false,
                  facet: true,
                  rank: 1,
                  options: [
                    {
                      key: '5w-30',
                      label: '5W-30',
                      translations: null,
                      rank: 1,
                    },
                    {
                      key: '0w-20',
                      label: '0W-20',
                      translations: null,
                      rank: 2,
                    },
                  ],
                },
                {
                  key: 'volume',
                  type: 'number',
                  unit: 'l',
                  label: 'Объем',
                  translations: null,
                  required: false,
                  facet: false,
                  rank: 2,
                  options: [],
                },
              ],
            },
          ],
        });
      });
    });
  },
});
