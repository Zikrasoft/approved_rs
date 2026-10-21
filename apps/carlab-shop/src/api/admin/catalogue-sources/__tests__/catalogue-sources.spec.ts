import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-sources',
  dbName: 'medusa-catalogue-sources-integration',
  testSuite: ({ api, getContainer }) => {
    describe('admin catalogue sources', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;

      const sources = async () =>
        (await api.get('/admin/catalogue-sources', adminHeaders)).data.sources;
      const remove = (source: string) =>
        api
          .delete(
            `/admin/catalogue-sources/${encodeURIComponent(source)}`,
            adminHeaders,
          )
          .catch((error) => error.response);

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@catalogue-sources-tests.local',
          'supersecret',
        );
        const [bmw] = await catalog.createBrands([
          { name: 'BMW', slug: 'bmw' },
        ]);
        await catalog.createPartWithIdentifiers({
          name: 'Oil filter',
          identifiers: [{ type: 'oem', brand_id: bmw.id, value: '11 42 1' }],
        });
        await catalog.createPartWithIdentifiers({
          name: 'Brake pad',
          source: 'tecdoc-pdf',
          identifiers: [{ type: 'oem', brand_id: bmw.id, value: '34 11 1' }],
        });
        await catalog.createBrands([
          { name: 'Mahle', slug: 'mahle', source: 'mahle-pdf' },
        ]);
      });

      it('counts the catalogue rows of every source', async () => {
        expect(await sources()).toEqual([
          { source: 'mahle-pdf', rows: 1 },
          { source: 'manual', rows: 3 },
          { source: 'tecdoc-pdf', rows: 2 },
        ]);
      });

      it('removes every row of a source and leaves the others', async () => {
        const response = await remove('tecdoc-pdf');

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ source: 'tecdoc-pdf', deleted: 2 });
        expect(
          (await catalog.listParts({}, { take: null })).map(({ name }) => name),
        ).toEqual(['Oil filter']);
        expect(
          (await sources()).map(({ source }: { source: string }) => source),
        ).toEqual(['mahle-pdf', 'manual']);
      });

      it('refuses a source whose rows others still use and removes nothing', async () => {
        const [mahle] = await catalog.listBrands({ slug: 'mahle' });
        await catalog.createPartWithIdentifiers({
          name: 'Air filter',
          identifiers: [{ type: 'oem', brand_id: mahle.id, value: 'LX 1' }],
        });

        const response = await remove('mahle-pdf');

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('SOURCE_IN_USE');
        expect(await catalog.listBrands({ slug: 'mahle' })).toHaveLength(1);
      });
    });
  },
});
