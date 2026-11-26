import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { clearCatalogueMemo } from '../../../../../lib/catalogue-memo';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-pages-hub',
  dbName: 'medusa-catalogue-pages-hub-integration',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages/hub', () => {
      it('answers only the makes and Categories of the page list', async () => {
        clearCatalogueMemo();
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        await catalog.createCategories({ slug: 'filters', name: 'Filters' });
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: 'hub-tests',
            type: 'publishable',
            created_by: 'test',
          });
        const headers = { 'x-publishable-api-key': key.token };

        const hub = await api.get('/store/catalogue-pages/hub', { headers });
        const list = await api.get('/store/catalogue-pages', { headers });

        expect(Object.keys(hub.data).sort()).toEqual(['categories', 'makes']);
        expect(hub.data.makes).toEqual(list.data.makes);
        expect(hub.data.categories).toEqual(list.data.categories);
        expect(hub.data.categories).toEqual([
          expect.objectContaining({ slug: 'filters' }),
        ]);
        clearCatalogueMemo();
      });
    });
  },
});
