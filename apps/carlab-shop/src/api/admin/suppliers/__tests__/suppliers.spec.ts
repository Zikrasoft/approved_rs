import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
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
        ['no markup', {}],
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
