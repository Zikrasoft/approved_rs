import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import { publishAllNumbers } from '../../../../lib/publish/published';

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
          expect.objectContaining({
            id: created.data.category.id,
            code: 'IC-AIR',
            category_id: categoryId,
            updated_at: expect.any(String),
            updated_by_user: expect.objectContaining({ email: ADMIN_EMAIL }),
          }),
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

      it('refuses a supplier category code that differs from a mapped one only by case', async () => {
        const responses = await Promise.all(
          ['IC-OIL', 'ic-oil', ' Ic-Oil '].map((code) =>
            call('post', `/admin/suppliers/${supplierId}/categories`, {
              code,
              category_id: categoryId,
            }),
          ),
        );

        expect(responses.map(({ status }) => status).sort()).toEqual([
          200, 409, 409,
        ]);
        expect(
          responses
            .filter(({ status }) => status === 409)
            .map(({ data }) => [data.code, data.entity]),
        ).toEqual(Array(2).fill(['ALREADY_EXISTS', 'supplier_category']));
        const listed = await call(
          'get',
          `/admin/suppliers/${supplierId}/categories`,
        );
        for (const { id } of listed.data.categories) {
          await call(
            'delete',
            `/admin/suppliers/${supplierId}/categories/${id}`,
          );
        }
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
          expect.objectContaining({
            id: supplierId,
            name: 'Admin-test supplier',
            markup_percentage: 10,
            released_kinds: ['cross_references', 'applicability'],
            updated_at: expect.any(String),
            updated_by_user: expect.objectContaining({ email: ADMIN_EMAIL }),
          }),
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

      it('keeps a decimal markup as typed', async () => {
        const response = await api.post(
          `/admin/suppliers/${supplierId}`,
          { markup_percentage: 12.5 },
          adminHeaders,
        );

        expect(response.data.supplier.markup_percentage).toBe(12.5);
        expect(
          (await supplierService.retrieveSupplier(supplierId))
            .markup_percentage,
        ).toBe(12.5);
      });

      it.each([
        ['a markup above 500%', { markup_percentage: 501 }],
        ['a markup with three decimals', { markup_percentage: 12.345 }],
      ])('names the markup field for %s', async (_, body) => {
        const response = await api
          .post(`/admin/suppliers/${supplierId}`, body, adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'INVALID_FIELD',
          field: 'markup_percentage',
        });
      });

      it.each([
        ['an empty markup', { markup_percentage: '' }],
        ['a markup sent as null', { markup_percentage: null }],
      ])(
        'asks for the markup for %s and keeps the stored one',
        async (_, body) => {
          const before = (await supplierService.retrieveSupplier(supplierId))
            .markup_percentage;

          const response = await api
            .post(`/admin/suppliers/${supplierId}`, body, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(response.data).toMatchObject({
            code: 'FIELD_REQUIRED',
            field: 'markup_percentage',
          });
          expect(
            (await supplierService.retrieveSupplier(supplierId))
              .markup_percentage,
          ).toBe(before);
        },
      );

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

      it('reindexes the prices of every brand-number the supplier offers when its markup changes', async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const brand = await catalog.createBrands({
          name: 'Mann',
          slug: 'mann',
        });
        const values = ['C27009', 'C27010'];
        for (const value of values) {
          const partId = await catalog.createPartWithIdentifiers({
            name: `Фильтр ${value}`,
            identifiers: [
              { type: 'manufacturer-number', brand_id: brand.id, value },
            ],
          });
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: partId,
          });
          await supplierService.createSupplierOffers({
            supplier_id: supplierId,
            supplier_article_id: value,
            part_identifier_id: identifier.id,
            cost_price: 1000,
            stock_quantity: 1,
            lead_time_days: 0,
          });
        }
        await call('post', `/admin/suppliers/${supplierId}`, {
          markup_percentage: 10,
        });
        await publishAllNumbers(container);
        await container
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
        const pricedAt = async (price: number) =>
          (
            await container.resolve(ContainerRegistrationKeys.QUERY).search({
              entity: 'part_identifier',
              fields: ['id'],
              filters: { price: { $gte: price, $lte: price } },
              pagination: { skip: 0, take: 10 },
            })
          ).search_result.metadata.count;
        expect(await pricedAt(1100)).toBe(values.length);

        const response = await call('post', `/admin/suppliers/${supplierId}`, {
          markup_percentage: 50,
        });

        expect(response.status).toBe(200);
        let count: number | null = 0;
        for (
          let attempt = 0;
          attempt < 20 && count !== values.length;
          attempt += 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          count = await pricedAt(1500);
        }
        expect(count).toBe(values.length);
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
