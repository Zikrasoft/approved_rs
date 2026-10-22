import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
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
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      const search = async (q: string) =>
        (
          await api.get(
            `/store/search?q=${encodeURIComponent(q)}&locale=ru`,
            storeHeaders,
          )
        ).data;

      const reindex = () =>
        getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });

      const settled = async <T>(
        read: () => Promise<T>,
        done: (value: T) => boolean,
      ) => {
        for (let attempt = 0; attempt < 50; attempt++) {
          const value = await read();
          if (done(value)) {
            return value;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return read();
      };

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
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'catalogue-sources',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
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
        expect(response.data).toEqual({
          source: 'tecdoc-pdf',
          deleted: 2,
          import_disabled: false,
        });
        expect(
          (await catalog.listParts({}, { take: null })).map(({ name }) => name),
        ).toEqual(['Oil filter']);
        expect(
          (await sources()).map(({ source }: { source: string }) => source),
        ).toEqual(['mahle-pdf', 'manual']);
      });

      it('drops the deleted numbers from search without a publish', async () => {
        await reindex();
        expect((await search('brake pad')).count).toBe(1);

        await remove('tecdoc-pdf');

        expect(
          await settled(
            () => search('brake pad'),
            ({ count }) => count === 0,
          ),
        ).toMatchObject({ results: [], count: 0 });
      });

      it('never deletes the manual source', async () => {
        const before = await sources();

        const response = await remove('manual');

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('MANUAL_SOURCE');
        expect(await sources()).toEqual(before);
      });

      it('refuses a source whose rows others still use and removes nothing', async () => {
        const [mahle] = await catalog.listBrands({ slug: 'mahle' });
        await catalog.createPartWithIdentifiers({
          name: 'Air filter',
          identifiers: [{ type: 'oem', brand_id: mahle.id, value: 'LX 1' }],
        });

        const response = await remove('mahle-pdf');

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'SOURCE_IN_USE',
          blocked: 'brand',
        });
        expect(await catalog.listBrands({ slug: 'mahle' })).toHaveLength(1);
      });

      it('counts only the results it can still show while the index lags', async () => {
        await reindex();
        const [pad] = await catalog.listParts({ name: 'Brake pad' });
        await catalog.deleteParts(pad.id);

        expect(await search('brake pad')).toMatchObject({
          results: [],
          count: 0,
        });
      });
    });
  },
});
