import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('admin brands', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let intercars: { id: string };

      const post = (path: string, body: unknown) =>
        api.post(path, body, adminHeaders).catch((error) => error.response);
      const remove = (path: string) =>
        api.delete(path, adminHeaders).catch((error) => error.response);

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        intercars = await suppliers.createSuppliers({
          name: 'Intercars',
          markup_percentage: 20,
        });
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@brands-tests.local',
          'supersecret',
        );
      });

      it('creates a Brand with per-supplier spellings and lists it', async () => {
        const created = await post('/admin/brands', {
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        expect(created.status).toBe(200);
        const brandId = created.data.brand.id;

        for (const value of ['MANN-FILTER', 'MANN']) {
          const spelling = await post(`/admin/brands/${brandId}/spellings`, {
            supplier_id: intercars.id,
            value,
          });
          expect(spelling.status).toBe(200);
        }

        const listed = await api.get('/admin/brands', adminHeaders);

        expect(listed.data.brands).toEqual([
          expect.objectContaining({
            id: brandId,
            name: 'Mann-Filter',
            slug: 'mann-filter',
            source: 'manual',
            created_by: expect.stringMatching(/^user_/),
            spellings: expect.arrayContaining([
              expect.objectContaining({
                supplier_id: intercars.id,
                value: 'MANN-FILTER',
              }),
              expect.objectContaining({
                supplier_id: intercars.id,
                value: 'MANN',
              }),
            ]),
          }),
        ]);
      });

      it.each([
        ['an empty name', { name: '', slug: 'x' }],
        ['a slug with spaces', { name: 'Bosch', slug: 'bo sch' }],
        ['an upper-case slug', { name: 'Bosch', slug: 'Bosch' }],
        ['an unknown key', { name: 'Bosch', slug: 'bosch', extra: 1 }],
      ])('returns a 400 for %s', async (_, body) => {
        expect((await post('/admin/brands', body)).status).toBe(400);
      });

      it('refuses a second Brand with the same slug', async () => {
        await post('/admin/brands', { name: 'Mahle', slug: 'mahle' });

        const response = await post('/admin/brands', {
          name: 'Mahle Original',
          slug: 'mahle',
        });

        expect(response.status).toBe(400);
      });

      it('refuses a spelling for an unknown supplier', async () => {
        const brand = await catalog.createBrands({
          name: 'Bosch',
          slug: 'bosch',
        });

        const response = await post(`/admin/brands/${brand.id}/spellings`, {
          supplier_id: 'sup_missing',
          value: 'BOSCH',
        });

        expect(response.status).toBe(404);
      });

      it('refuses one supplier spelling for two Brands', async () => {
        const [first, second] = await catalog.createBrands([
          { name: 'Febi', slug: 'febi' },
          { name: 'Febi Bilstein', slug: 'febi-bilstein' },
        ]);
        await post(`/admin/brands/${first.id}/spellings`, {
          supplier_id: intercars.id,
          value: 'FEBI',
        });

        const response = await post(`/admin/brands/${second.id}/spellings`, {
          supplier_id: intercars.id,
          value: 'FEBI',
        });

        expect(response.status).toBe(400);
      });

      it('deletes a spelling', async () => {
        const brand = await catalog.createBrands({
          name: 'Hengst',
          slug: 'hengst',
        });
        const spelling = await post(`/admin/brands/${brand.id}/spellings`, {
          supplier_id: intercars.id,
          value: 'HENGST FILTER',
        });

        const response = await remove(
          `/admin/brands/${brand.id}/spellings/${spelling.data.spelling.id}`,
        );

        expect(response.status).toBe(200);
        expect(
          await catalog.listBrandSpellings({ brand_id: brand.id }),
        ).toHaveLength(0);
      });

      it('deletes an unused Brand with its spellings', async () => {
        const brand = await catalog.createBrands({
          name: 'Unused',
          slug: 'unused',
        });
        await post(`/admin/brands/${brand.id}/spellings`, {
          supplier_id: intercars.id,
          value: 'UNUSED',
        });

        const response = await remove(`/admin/brands/${brand.id}`);

        expect(response.status).toBe(200);
        expect(await catalog.listBrands({ id: brand.id })).toHaveLength(0);
        expect(
          await catalog.listBrandSpellings({ brand_id: brand.id }),
        ).toHaveLength(0);
      });

      it('refuses to delete a Brand its PartIdentifiers use', async () => {
        const brand = await catalog.createBrands({
          name: 'Used',
          slug: 'used',
        });
        await catalog.createPartWithIdentifiers({
          name: 'Used part',
          identifiers: [{ type: 'oem', brand_id: brand.id, value: 'USED-1' }],
        });

        const response = await remove(`/admin/brands/${brand.id}`);

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('IN_USE');
        expect(await catalog.listBrands({ id: brand.id })).toHaveLength(1);
      });

      it('returns a 404 for an unknown Brand', async () => {
        expect((await remove('/admin/brands/brand_missing')).status).toBe(404);
      });
    });
  },
});
