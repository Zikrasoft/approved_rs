import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { INSTALLATION_SEED_PRICE, SHOP } from '../../src/lib/shop';
import { BATTERIES } from '../../src/scripts/battery-fixture';
import seedBatteries from '../../src/scripts/seed-batteries';
import {
  type StoreHeaders,
  anotherClient,
  pickupOptionId,
  rsdRegionId,
  storeHeaders,
  variantIdBySku,
} from './store-context';

jest.setTimeout(180_000);

const BOSCH = BATTERIES.find((battery) => battery.handle === 'bosch-s4-024')!;
const BOSCH_SKU = 'BOSCH-S4-024';
const INSTALLATION = 'battery-installation';

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

type CartOptions = {
  contact?: object;
  locale?: string | null;
  cartHeaders?: Record<string, string>;
};

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    beforeAll(() => seedBatteries({ container: getContainer() } as never));

    const readyCart = async ({
      contact = CONTACT,
      locale = 'sr-RS',
      cartHeaders = {},
    }: CartOptions = {}) => {
      const headers = await storeHeaders(getContainer);
      const regionId = await rsdRegionId(api, headers);
      const battery = await variantIdBySku(
        api,
        headers,
        regionId,
        BOSCH.handle,
        BOSCH_SKU,
      );
      const installation = await variantIdBySku(
        api,
        headers,
        regionId,
        INSTALLATION,
        INSTALLATION.toUpperCase(),
      );

      const { data: created } = await api.post(
        '/store/carts',
        { region_id: regionId, ...(locale ? { locale } : {}) },
        { headers: { ...headers, ...cartHeaders } },
      );
      const cartId: string = created.cart.id;

      for (const variant_id of [battery, installation]) {
        await api.post(
          `/store/carts/${cartId}/line-items`,
          { variant_id, quantity: 1 },
          { headers },
        );
      }
      await api.post(`/store/carts/${cartId}`, contact, { headers });
      await api.post(
        `/store/carts/${cartId}/shipping-methods`,
        { option_id: await pickupOptionId(getContainer) },
        { headers },
      );

      return { cartId, headers, battery };
    };

    const orderCount = async (): Promise<number> => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: 'order', fields: ['id'] });
      return data.length;
    };

    const complete = async (cartId: string, headers: StoreHeaders) => {
      const { data } = await api.post(
        '/store/payment-collections',
        { cart_id: cartId },
        { headers },
      );
      await api.post(
        `/store/payment-collections/${data.payment_collection.id}/payment-sessions`,
        { provider_id: SHOP.paymentProvider },
        { headers },
      );
      return api.post(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: { ...headers, ...anotherClient() } },
      );
    };

    it('offers pickup for free to a Serbian cart', async () => {
      const { cartId, headers } = await readyCart();

      const { data } = await api.get(
        `/store/shipping-options?cart_id=${cartId}`,
        {
          headers,
        },
      );

      const pickup = data.shipping_options.find(
        (option: { type?: { code?: string } }) =>
          option.type?.code === SHOP.pickupCode,
      );
      expect(pickup).toBeDefined();
      expect(pickup.amount).toBe(0);
    });

    it('turns a battery plus installation into an order that reserves the battery', async () => {
      const { cartId, headers, battery } = await readyCart();

      const { data } = await complete(cartId, headers);

      expect(data.type).toBe('order');
      expect(data.order.total).toBe(BOSCH.price + INSTALLATION_SEED_PRICE);
      expect(data.order.email).toBe(CONTACT.email);

      const inventory = getContainer().resolve(Modules.INVENTORY);
      const lines = data.order.items as { id: string; variant_id: string }[];
      const batteryLine = lines.find((line) => line.variant_id === battery);
      const serviceLine = lines.find((line) => line.variant_id !== battery);

      const reserved = await inventory.listReservationItems({
        line_item_id: [batteryLine!.id],
      });
      expect(reserved.map((item) => Number(item.quantity))).toEqual([1]);
      expect(
        await inventory.listReservationItems({
          line_item_id: [serviceLine!.id],
        }),
      ).toEqual([]);
    });

    it('keeps the buyer contact and the comment on the order', async () => {
      const { cartId, headers } = await readyCart();

      const { data } = await complete(cartId, headers);

      const {
        data: [order],
      } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: 'order',
          fields: [
            'metadata',
            'shipping_address.first_name',
            'shipping_address.phone',
          ],
          filters: { id: data.order.id },
        });
      expect(order.shipping_address).toMatchObject({
        first_name: 'Marko',
        phone: '+381601234567',
      });
      expect(order.metadata).toMatchObject({
        comment: 'Posle 17h',
        contact_channel: 'viber',
      });
    });

    it.each([
      ['no email', { ...CONTACT, email: undefined }],
      [
        'no name',
        {
          ...CONTACT,
          shipping_address: { ...CONTACT.shipping_address, first_name: '' },
        },
      ],
      [
        'a phone that is not international',
        {
          ...CONTACT,
          shipping_address: {
            ...CONTACT.shipping_address,
            phone: '060 123 4567',
          },
        },
      ],
    ])('refuses an order with %s, in Russian', async (_label, contact) => {
      const { cartId, headers } = await readyCart({ contact });
      const before = await orderCount();

      const error = await complete(cartId, headers).catch((failure) => failure);

      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toContain(
        'Не заполнено или заполнено неверно',
      );
      expect(await orderCount()).toBe(before);
    });

    it('refuses an order a bot filled in', async () => {
      const { cartId, headers } = await readyCart({
        contact: { ...CONTACT, metadata: { website: 'http://spam.example' } },
      });
      const before = await orderCount();

      const error = await complete(cartId, headers).catch((failure) => failure);

      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toBe('Заказ не принят');
      expect(await orderCount()).toBe(before);
    });

    const orderLocale = async (orderId: string): Promise<string | null> => {
      const {
        data: [order],
      } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: 'order',
          fields: ['locale'],
          filters: { id: orderId },
        });
      return order.locale ?? null;
    };

    it('carries the language the cart was opened in onto the order (M-4)', async () => {
      const { cartId, headers } = await readyCart({ locale: 'en-US' });

      const { data } = await complete(cartId, headers);

      expect(await orderLocale(data.order.id)).toBe('en-US');
    });

    it('takes the order language from the cart body only, never from the locale header', async () => {
      const { cartId, headers } = await readyCart({
        locale: null,
        cartHeaders: { 'x-medusa-locale': 'en-US' },
      });

      const { data } = await complete(cartId, headers);

      expect(await orderLocale(data.order.id)).toBeNull();
    });
  },
});
