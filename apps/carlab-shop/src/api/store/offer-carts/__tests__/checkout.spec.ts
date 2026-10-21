import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { normalizePartNumber } from '@podbor/catalog-contract';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { seedCashAtPickupCommerceDefaults } from '../../../../lib/commerce-defaults';
import { OFFER_PRICE_CHANGED_CODE } from '../../../../workflows/hooks/complete-cart-guard';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'cart',
  testSuite: ({ api, getContainer }) => {
    describe('offer cart checkout', () => {
      let offerId: string;
      let supplierService: SupplierModuleService;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      beforeAll(async () => {
        const container = getContainer();
        await seedCashAtPickupCommerceDefaults(container);

        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        supplierService = container.resolve(SUPPLIER_MODULE);
        const apiKeyModuleService: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );

        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'offer-cart-checkout-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        const [bmw] = await catalog.createBrands([
          { name: 'BMW', slug: 'bmw' },
        ]);

        const part = await catalog.createParts({
          name: 'Oil filter, BMW B47/B48 engines',
        });
        const identifier = await catalog.createPartIdentifiers({
          part_id: part.id,
          type: 'oem',
          brand_id: bmw.id,
          value: '11 42 8575211',
          normalized_value: normalizePartNumber('11 42 8575211'),
        });
        const supplier = await supplierService.createSuppliers({
          name: 'Intercars',
          markup_percentage: 20,
        });
        const offer = await supplierService.createSupplierOffers({
          part_identifier_id: identifier.id,
          supplier_id: supplier.id,
          supplier_article_id: 'IC-11428575211',
          cost_price: 1542,
          stock_quantity: 12,
          lead_time: 'in_stock',
        });
        offerId = offer.id;
      });

      async function createCartWithOffer() {
        const {
          data: { cart },
        } = await api.post('/store/offer-carts', {}, storeHeaders);

        await api.post(
          `/store/offer-carts/${cart.id}/items`,
          { offer_id: offerId, quantity: 1 },
          storeHeaders,
        );

        return cart.id as string;
      }

      it.each([
        ['a zero quantity', { quantity: 0 }],
        ['a fractional quantity', { quantity: 1.5 }],
        ['no offer', { offer_id: undefined }],
      ])('returns a 400 when adding an item with %s', async (_, override) => {
        const {
          data: { cart },
        } = await api.post('/store/offer-carts', {}, storeHeaders);

        const response = await api
          .post(
            `/store/offer-carts/${cart.id}/items`,
            { offer_id: offerId, quantity: 1, ...override },
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(400);
      });

      it('returns a 400 for a malformed email on a new cart', async () => {
        const response = await api
          .post('/store/offer-carts', { email: 'not-an-email' }, storeHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
      });

      it('completes checkout normally when the offer price did not change', async () => {
        const cartId = await createCartWithOffer();

        const response = await api.post(
          `/store/carts/${cartId}/complete`,
          {},
          storeHeaders,
        );

        expect(response.data.type).toBe('order');
        expect(response.data.order.items).toHaveLength(1);
        expect(response.data.order.items[0].unit_price).toBe(1850);

        const orderModuleService = getContainer().resolve(Modules.ORDER);
        const order = await orderModuleService.retrieveOrder(
          response.data.order.id,
        );
        expect(order.metadata).toMatchObject({
          fulfillment: 'cash_at_pickup',
        });
      });

      it('blocks completion with a structured error when the offer price changed', async () => {
        const cartId = await createCartWithOffer();
        await supplierService.updateSupplierOffers({
          id: offerId,
          cost_price: 1833,
        });

        await expect(
          api.post(`/store/carts/${cartId}/complete`, {}, storeHeaders),
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: { code: OFFER_PRICE_CHANGED_CODE },
          },
        });

        await supplierService.updateSupplierOffers({
          id: offerId,
          cost_price: 1542,
        });
      });

      it('completes checkout at the new price after a reprice-and-confirm', async () => {
        const cartId = await createCartWithOffer();
        await supplierService.updateSupplierOffers({
          id: offerId,
          cost_price: 1833,
        });

        await expect(
          api.post(`/store/carts/${cartId}/complete`, {}, storeHeaders),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const repriceResponse = await api.post(
          `/store/offer-carts/${cartId}/reprice`,
          {},
          storeHeaders,
        );
        expect(repriceResponse.data.repriced_item_ids).toHaveLength(1);
        expect(repriceResponse.data.cart.items[0].unit_price).toBe(2200);

        const completed = await api.post(
          `/store/carts/${cartId}/complete`,
          {},
          storeHeaders,
        );

        expect(completed.data.type).toBe('order');
        expect(completed.data.order.items[0].unit_price).toBe(2200);

        await supplierService.updateSupplierOffers({
          id: offerId,
          cost_price: 1542,
        });
      });
    });
  },
});
