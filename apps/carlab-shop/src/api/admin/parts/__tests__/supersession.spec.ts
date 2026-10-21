import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-supersession-integration',
  testSuite: ({ api, getContainer }) => {
    describe('supersession', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;
      let bmw: { id: string };

      const createPart = (name: string, value: string) =>
        catalog.createPartWithIdentifiers({
          name,
          identifiers: [{ type: 'oem', brand_id: bmw.id, value }],
        });

      const replace = (partId: string, replacedById: string | null) =>
        api
          .post(
            `/admin/parts/${partId}`,
            { replaced_by_id: replacedById },
            adminHeaders,
          )
          .catch((error) => error.response);

      const pageFor = async (normalizedValue: string) => {
        const response = await api.get(
          '/store/part-pages?limit=5000',
          storeHeaders,
        );
        return response.data.pages.find(
          (page: { normalized_value: string }) =>
            page.normalized_value === normalizedValue,
        );
      };

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        bmw = await catalog.createBrands({ name: 'BMW', slug: 'bmw' });
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@supersession-tests.local',
          'supersecret',
        );
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'supersession-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
      });

      describe('POST /admin/part-identifiers/:id', () => {
        it('marks a number superseded and the store page says so', async () => {
          const partId = await createPart('Old oil filter', '11 42 7953125');
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: partId,
          });

          const response = await api.post(
            `/admin/part-identifiers/${identifier.id}`,
            { superseded: true },
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.part_identifier).toMatchObject({
            id: identifier.id,
            superseded: true,
            updated_by: expect.any(String),
          });
          expect(await pageFor('11427953125')).toMatchObject({
            superseded: true,
          });
        });

        it('refuses a body without a superseded flag', async () => {
          const partId = await createPart('Flagless filter', '11 42 7953126');
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: partId,
          });

          const response = await api
            .post(
              `/admin/part-identifiers/${identifier.id}`,
              { superseded: 'yes' },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });
      });

      describe('POST /admin/parts/:id', () => {
        it('links a Part to its replacement and the store page carries it', async () => {
          const oldId = await createPart('Brake pad, old', '34 11 6761252');
          const newId = await catalog.createPartWithIdentifiers({
            name: 'Brake pad, new',
            identifiers: ['34 11 6761254', '34 11 6761253'].map((value) => ({
              type: 'oem' as const,
              brand_id: bmw.id,
              value,
            })),
          });
          const [retired] = await catalog.listPartIdentifiers({
            normalized_value: '34116761254',
          });
          await catalog.updatePartIdentifiers({
            id: retired.id,
            superseded: true,
          });

          const response = await replace(oldId, newId);

          expect(response.status).toBe(200);
          expect(response.data.part).toMatchObject({
            id: oldId,
            replaced_by_id: newId,
          });
          expect((await pageFor('34116761252')).part).toEqual({
            id: oldId,
            name: 'Brake pad, old',
            replaced_by: {
              id: newId,
              name: 'Brake pad, new',
              brand_number: expect.objectContaining({
                normalized_value: '34116761253',
                brand: { name: 'BMW', slug: 'bmw' },
              }),
            },
          });
          expect((await pageFor('34116761253')).part.replaced_by).toBeNull();
        });

        it('clears a replacement', async () => {
          const oldId = await createPart('Wiper, old', '61 61 0001');
          const newId = await createPart('Wiper, new', '61 61 0002');
          await replace(oldId, newId);

          const response = await replace(oldId, null);

          expect(response.status).toBe(200);
          expect((await pageFor('61610001')).part.replaced_by).toBeNull();
        });

        it('refuses a Part replaced by itself', async () => {
          const id = await createPart('Self filter', '11 00 0001');

          expect((await replace(id, id)).status).toBe(400);
        });

        it('refuses a link that would close a cycle', async () => {
          const a = await createPart('Cycle A', '11 00 0011');
          const b = await createPart('Cycle B', '11 00 0012');
          const c = await createPart('Cycle C', '11 00 0013');
          expect((await replace(a, b)).status).toBe(200);
          expect((await replace(b, c)).status).toBe(200);

          const response = await replace(c, a);

          expect(response.status).toBe(400);
          expect(
            (await catalog.retrievePart(c)).replaced_by_id ?? null,
          ).toBeNull();
        });

        it('returns a 404 for an unknown replacement', async () => {
          const id = await createPart('Lonely filter', '11 00 0021');

          expect((await replace(id, 'part_missing')).status).toBe(404);
        });

        it('keeps the replaced Part when its replacement is deleted', async () => {
          const oldId = await createPart('Mirror, old', '51 16 0001');
          const newId = await createPart('Mirror, new', '51 16 0002');
          await replace(oldId, newId);

          await api.delete(`/admin/parts/${newId}`, adminHeaders);

          expect((await pageFor('51160001')).part.replaced_by).toBeNull();
        });
      });
    });
  },
});
