import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const ADMIN_EMAIL = 'admin@suppliers-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'supplier',
  testSuite: ({ api, getContainer }) => {
    describe('POST /admin/suppliers/:id', () => {
      let adminHeaders: { headers: { authorization: string } };
      let supplierService: SupplierModuleService;
      let supplierId: string;
      let categoryId: string;

      beforeAll(async () => {
        supplierService = getContainer().resolve(SUPPLIER_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );

        const supplier = await supplierService.createSuppliers({
          name: 'Admin-test supplier',
          markup_percentage: 10,
        });
        supplierId = supplier.id;
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        categoryId = (
          await catalog.createCategories({
            slug: 'air-filters',
            name: 'Воздушные фильтры',
          })
        ).id;
      });

      const call = (
        method: 'get' | 'post' | 'delete',
        path: string,
        body?: unknown,
      ) =>
        (method === 'post'
          ? api.post(path, body, adminHeaders)
          : api[method](path, adminHeaders)
        ).catch((error: { response: unknown }) => error.response);

      it('maps a supplier category to a Category, lists it and removes it', async () => {
        const created = await call(
          'post',
          `/admin/suppliers/${supplierId}/categories`,
          { code: 'IC-AIR', category_id: categoryId },
        );
        expect(created.status).toBe(200);

        const listed = await call(
          'get',
          `/admin/suppliers/${supplierId}/categories`,
        );
        expect(listed.data.categories).toEqual([
          {
            id: created.data.category.id,
            code: 'IC-AIR',
            category_id: categoryId,
          },
        ]);

        const removed = await call(
          'delete',
          `/admin/suppliers/${supplierId}/categories/${created.data.category.id}`,
        );
        expect(removed.status).toBe(200);
        expect(
          (await call('get', `/admin/suppliers/${supplierId}/categories`)).data
            .categories,
        ).toEqual([]);
      });

      it.each([
        ['an empty code', { code: '', category_id: 'cat_1' }],
        ['an unknown key', { code: 'IC-AIR', category_id: 'cat_1', x: 1 }],
      ])('returns a 400 for a category mapping with %s', async (_, body) => {
        expect(
          (
            await call(
              'post',
              `/admin/suppliers/${supplierId}/categories`,
              body,
            )
          ).status,
        ).toBe(400);
      });

      it('returns a 404 for a mapping to an unknown Category', async () => {
        expect(
          (
            await call('post', `/admin/suppliers/${supplierId}/categories`, {
              code: 'IC-AIR',
              category_id: 'cat_missing',
            })
          ).status,
        ).toBe(404);
      });

      it('releases staged data kinds and lists them on the supplier', async () => {
        const updated = await call('post', `/admin/suppliers/${supplierId}`, {
          released_kinds: ['cross_references', 'applicability'],
        });
        expect(updated.status).toBe(200);

        const listed = await call('get', '/admin/suppliers');
        expect(listed.data.suppliers).toEqual([
          {
            id: supplierId,
            name: 'Admin-test supplier',
            markup_percentage: 10,
            released_kinds: ['cross_references', 'applicability'],
          },
        ]);
      });

      it('rejects the request without admin auth', async () => {
        await expect(
          api.post(`/admin/suppliers/${supplierId}`, { markup_percentage: 50 }),
        ).rejects.toMatchObject({ response: { status: 401 } });
      });

      it('updates the markup percentage', async () => {
        const response = await api.post(
          `/admin/suppliers/${supplierId}`,
          { markup_percentage: 50 },
          adminHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.supplier).toMatchObject({
          id: supplierId,
          markup_percentage: 50,
        });

        const supplier = await supplierService.retrieveSupplier(supplierId);
        expect(supplier.markup_percentage).toBe(50);
      });

      it.each([
        ['a negative markup', { markup_percentage: -5 }],
        ['a markup sent as text', { markup_percentage: '50' }],
        ['nothing to change', {}],
        ['an unknown data kind', { released_kinds: ['tecdoc'] }],
      ])('returns a 400 for %s', async (_, body) => {
        const response = await api
          .post(`/admin/suppliers/${supplierId}`, body, adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
      });

      it('returns a 404 for an unknown supplier', async () => {
        const response = await api
          .post(
            '/admin/suppliers/sup_missing',
            { markup_percentage: 10 },
            adminHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });
    });
  },
});
