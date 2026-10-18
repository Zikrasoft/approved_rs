import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import { seedCashAtPickupCommerceDefaults } from '../../../../lib/commerce-defaults';
import { OFFER_PRICE_CHANGED_CODE } from '../../../../workflows/hooks/complete-cart-guard';

medusaIntegrationTestRunner({
  moduleName: 'cart',
  testSuite: ({ api, getContainer }) => {
    describe('offer cart checkout', () => {
      let offerId: string;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      beforeAll(async () => {
        const container = getContainer();
        await seedCashAtPickupCommerceDefaults(container);

        const partModuleService: PartModuleService =
          container.resolve(PART_MODULE);
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

        const part = await partModuleService.createParts({
          name: 'Oil filter, BMW B47/B48 engines',
        });
        const identifier = await partModuleService.createPartIdentifiers({
          part_id: part.id,
          type: 'oem',
          brand: 'BMW',
          value: '11 42 8575211',
        });
        const offer = await partModuleService.createSupplierOffers({
          identifier_id: identifier.id,
          supplier: 'Intercars',
          supplier_article_id: 'IC-11428575211',
          price: 1850,
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

        const partModuleService: PartModuleService =
          getContainer().resolve(PART_MODULE);
        await partModuleService.updateSupplierOffers({
          id: offerId,
          price: 2200,
        });

        await expect(
          api.post(`/store/carts/${cartId}/complete`, {}, storeHeaders),
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: { code: OFFER_PRICE_CHANGED_CODE },
          },
        });

        await partModuleService.updateSupplierOffers({
          id: offerId,
          price: 1850,
        });
      });

      it('completes checkout at the new price after a reprice-and-confirm', async () => {
        const cartId = await createCartWithOffer();

        const partModuleService: PartModuleService =
          getContainer().resolve(PART_MODULE);
        await partModuleService.updateSupplierOffers({
          id: offerId,
          price: 2200,
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

        await partModuleService.updateSupplierOffers({
          id: offerId,
          price: 1850,
        });
      });
    });
  },
});
