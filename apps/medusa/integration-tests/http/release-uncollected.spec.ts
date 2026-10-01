import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
} from '@medusajs/medusa/core-flows';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import releaseUncollected from '../../src/jobs/release-uncollected';
import { RESERVE_DAYS, SHOP } from '../../src/lib/shop';
import { BATTERIES } from '../../src/scripts/battery-fixture';
import seedBatteries from '../../src/scripts/seed-batteries';
import {
  anotherClient,
  pickupOptionId,
  rsdRegionId,
  storeHeaders,
  variantIdBySku,
} from './store-context';

jest.setTimeout(300_000);

const BOSCH = BATTERIES.find((battery) => battery.handle === 'bosch-s4-024')!;
const BOSCH_SKU = 'BOSCH-S4-024';

const CONTACT = {
  email: 'kupac@example.com',
  shipping_address: {
    first_name: 'Marko',
    last_name: 'Marković',
    phone: '+381601234567',
    country_code: 'rs',
  },
  metadata: { comment: 'Posle 17h', contact_channel: 'viber', website: '' },
};

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer, dbConnection }) => {
    beforeAll(() => seedBatteries({ container: getContainer() } as never));

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY);

    const orderField = async <T>(
      orderId: string,
      fields: string[],
    ): Promise<T> => {
      const {
        data: [order],
      } = await query().graph({
        entity: 'order',
        fields,
        filters: { id: orderId },
      });
      return order as T;
    };

    const placeOrder = async (): Promise<string> => {
      const headers = await storeHeaders(getContainer);
      const regionId = await rsdRegionId(api, headers);
      const variantId = await variantIdBySku(
        api,
        headers,
        regionId,
        BOSCH.handle,
        BOSCH_SKU,
      );

      const { data: created } = await api.post(
        '/store/carts',
        { region_id: regionId, locale: 'sr-RS' },
        { headers },
      );
      const cartId: string = created.cart.id;
      await api.post(
        `/store/carts/${cartId}/line-items`,
        { variant_id: variantId, quantity: 1 },
        { headers },
      );
      await api.post(`/store/carts/${cartId}`, CONTACT, { headers });
      await api.post(
        `/store/carts/${cartId}/shipping-methods`,
        { option_id: await pickupOptionId(getContainer) },
        { headers },
      );
      const { data: collection } = await api.post(
        '/store/payment-collections',
        { cart_id: cartId },
        { headers },
      );
      await api.post(
        `/store/payment-collections/${collection.payment_collection.id}/payment-sessions`,
        { provider_id: SHOP.paymentProvider },
        { headers },
      );
      const { data } = await api.post(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: { ...headers, ...anotherClient() } },
      );
      return data.order.id;
    };

    const capturePayment = async (orderId: string) => {
      const order = await orderField<{
        payment_collections: { payments: { id: string }[] }[];
      }>(orderId, ['payment_collections.payments.id']);
      await capturePaymentWorkflow(getContainer()).run({
        input: { payment_id: order.payment_collections[0].payments[0].id },
      });
    };

    const lineItemIds = async (orderId: string): Promise<string[]> => {
      const order = await orderField<{ items: { id: string }[] }>(orderId, [
        'items.id',
      ]);
      return order.items.map((item) => item.id);
    };

    const fulfil = async (orderId: string) => {
      await createOrderFulfillmentWorkflow(getContainer()).run({
        input: {
          order_id: orderId,
          items: (await lineItemIds(orderId)).map((id) => ({
            id,
            quantity: 1,
          })),
        },
      });
    };

    const reservedQuantities = async (lineIds: string[]) => {
      const reserved = await getContainer()
        .resolve(Modules.INVENTORY)
        .listReservationItems({ line_item_id: lineIds });
      return reserved.map((item) => Number(item.quantity));
    };

    const age = (orderId: string) =>
      dbConnection.raw(
        `update "order" set created_at = now() - interval '${RESERVE_DAYS + 1} days' where id = ?`,
        [orderId],
      );

    const statuses = async (ids: string[]) => {
      const { data } = await query().graph({
        entity: 'order',
        fields: ['id', 'status'],
        filters: { id: ids },
      });
      return Object.fromEntries(
        (data as { id: string; status: string }[]).map((order) => [
          order.id,
          order.status,
        ]),
      );
    };

    it('cancels the aged order nobody collected, frees its stock, and touches nothing else', async () => {
      const uncollected = await placeOrder();
      const inWindow = await placeOrder();
      const paid = await placeOrder();
      const fulfilled = await placeOrder();
      await capturePayment(paid);
      await fulfil(fulfilled);
      for (const orderId of [uncollected, paid, fulfilled]) {
        await age(orderId);
      }
      const releasedLines = await lineItemIds(uncollected);
      const heldLines = await lineItemIds(inWindow);
      expect(await reservedQuantities(releasedLines)).toEqual([1]);

      await releaseUncollected(getContainer());

      expect(await statuses([uncollected, inWindow, paid, fulfilled])).toEqual({
        [uncollected]: 'canceled',
        [inWindow]: 'pending',
        [paid]: 'pending',
        [fulfilled]: 'pending',
      });
      expect(await reservedQuantities(releasedLines)).toEqual([]);
      expect(await reservedQuantities(heldLines)).toEqual([1]);
    });
  },
});
