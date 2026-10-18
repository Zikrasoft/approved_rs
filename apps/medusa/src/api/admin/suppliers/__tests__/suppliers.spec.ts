import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';

const ADMIN_EMAIL = 'admin@suppliers-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'part',
  testSuite: ({ api, getContainer }) => {
    describe('POST /admin/suppliers/:id', () => {
      let adminHeaders: { headers: { authorization: string } };
      let partModuleService: PartModuleService;
      let supplierId: string;
      let offerId: string;

      beforeAll(async () => {
        partModuleService = getContainer().resolve(PART_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );

        const supplier = await partModuleService.createSuppliers({
          name: 'Admin-test supplier',
          markup_percentage: 10,
        });
        supplierId = supplier.id;

        const part = await partModuleService.createParts({
          name: 'Admin-test part',
        });
        const identifier = await partModuleService.createPartIdentifiers({
          part_id: part.id,
          type: 'oem',
          brand: 'BMW',
          value: 'ADMIN-TEST-1',
        });
        const offer = await partModuleService.createSupplierOffers({
          identifier_id: identifier.id,
          supplier_id: supplierId,
          supplier_article_id: 'ADMIN-TEST-OFFER-1',
          cost_price: 1000,
          stock_quantity: 5,
          lead_time: 'in_stock',
        });
        offerId = offer.id;
      });

      it('rejects the request without admin auth', async () => {
        await expect(
          api.post(`/admin/suppliers/${supplierId}`, { markup_percentage: 50 }),
        ).rejects.toMatchObject({ response: { status: 401 } });
      });

      it('updates the markup percentage and recomputes the sell price', async () => {
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

        const offer = await partModuleService.retrieveSupplierOffer(offerId);
        expect(offer.cost_price).toBe(1000);

        const supplier = await partModuleService.retrieveSupplier(supplierId);
        expect(supplier.markup_percentage).toBe(50);

        const sellPrice = Math.round(
          offer.cost_price * (1 + supplier.markup_percentage / 100),
        );
        expect(sellPrice).toBe(1500);
      });
    });
  },
});
