import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { asValue } from '@medusajs/framework/awilix';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { cartFingerprint, normalizePartNumber } from '@podbor/catalog-contract';

import { createFakeSupplier } from '../../../../../integration-tests/fakeSupplierAdapter';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { seedCashAtPickupCommerceDefaults } from '../../../../lib/commerce-defaults';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../../../../lib/suppliers/adapter';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import retryOrderLeads from '../../../../jobs/retry-order-leads';
import {
  LEAD_HANDOFF_ERROR,
  LEAD_HANDOFF_MAX_ATTEMPTS,
} from '../../../../lib/order-lead';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const intercars = createFakeSupplier('Intercars');
const ARTICLE = 'IC-11428575211';

const quote = (cost_price: number, quantity: number) =>
  intercars.quotes.set(ARTICLE, {
    article_id: ARTICLE,
    cost_price,
    currency: 'RSD',
    stock: [{ location: 'Beograd', quantity }],
    lead_time_days: 0,
  });

const CONTACT = {
  contact: '+381601234567',
  contact_channel: 'whatsapp',
  name: 'Marko',
  vin: 'WBA35BG070N074158',
  comment: 'Pozvati posle 17h',
  locale: 'sr',
};

type LeadPost = Record<string, string>;

medusaIntegrationTestRunner({
  moduleName: 'offer-cart-checkout',
  dbName: 'medusa-offer-cart-checkout-integration',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([intercars.adapter]),
      );
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('offer cart checkout', () => {
      let offerId: string;
      let identifierId: string;
      let warehouseOfferId: string;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let leadRoute: Server;
      const leads: LeadPost[] = [];
      let leadRouteStatus = 302;

      beforeAll(async () => {
        leadRoute = createServer((request, response) => {
          let body = '';
          request.on('data', (chunk) => (body += chunk));
          request.on('end', () => {
            leads.push(Object.fromEntries(new URLSearchParams(body)));
            response
              .writeHead(leadRouteStatus, { location: '/sr/thanks/' })
              .end();
          });
        });
        await new Promise<void>((resolve) => leadRoute.listen(0, resolve));
        process.env.LEAD_ROUTE_URL = `http://localhost:${(leadRoute.address() as AddressInfo).port}/api/leads`;

        const container = getContainer();
        await seedCashAtPickupCommerceDefaults(container);

        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        await createVehicleFixture(catalog, { typeCode: '35BG' });
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'offer-cart-checkout-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [bmw] = await catalog.createBrands([
          { name: 'BMW', slug: 'bmw' },
        ]);
        const part = await catalog.createParts({ name: 'Oil filter' });
        const identifier = await catalog.createPartIdentifiers({
          part_id: part.id,
          type: 'oem',
          brand_id: bmw.id,
          value: '11 42 8575211',
          normalized_value: normalizePartNumber('11 42 8575211'),
        });
        identifierId = identifier.id;
        const [supplier, warehouse] = await suppliers.createSuppliers([
          { name: 'Intercars', markup_percentage: 20 },
          { name: 'CarLab warehouse', markup_percentage: 10 },
        ]);
        const [offer, own] = await suppliers.createSupplierOffers([
          {
            part_identifier_id: identifier.id,
            supplier_id: supplier.id,
            supplier_article_id: ARTICLE,
            cost_price: 1000,
            stock_quantity: 1,
            lead_time_days: 3,
          },
          {
            part_identifier_id: identifier.id,
            supplier_id: warehouse.id,
            supplier_article_id: 'WH-1',
            cost_price: 2000,
            stock_quantity: 2,
            lead_time_days: 0,
          },
        ]);
        offerId = offer.id;
        warehouseOfferId = own.id;
      });

      beforeEach(() => {
        quote(1542, 12);
        leadRouteStatus = 302;
        leads.length = 0;
      });

      const waitFor = async <T>(read: () => Promise<T> | T) => {
        for (let tries = 0; tries < 50; tries += 1) {
          const value = await read();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return read();
      };

      afterAll(async () => {
        delete process.env.LEAD_ROUTE_URL;
        await new Promise((resolve) => leadRoute.close(resolve));
      });

      const post = (path: string, body: unknown = {}) =>
        api.post(path, body, storeHeaders).catch((error) => error.response);

      async function cartWith(quantity = 1, offer = offerId) {
        const {
          data: { cart },
        } = await post('/store/offer-carts');
        const added = await post(`/store/offer-carts/${cart.id}/items`, {
          offer_id: offer,
          quantity,
        });
        expect(added.status).toBe(200);
        return added.data.cart;
      }

      const complete = (
        cart: { id: string; items: Parameters<typeof cartFingerprint>[0] },
        body: Record<string, unknown> = CONTACT,
      ) =>
        post(`/store/offer-carts/${cart.id}/complete`, {
          cart_fingerprint: cartFingerprint(cart.items),
          ...body,
        });

      it.each([
        ['a zero quantity', { quantity: 0 }],
        ['a fractional quantity', { quantity: 1.5 }],
        ['no offer', { offer_id: undefined }],
      ])('returns a 400 when adding an item with %s', async (_, override) => {
        const {
          data: { cart },
        } = await post('/store/offer-carts');

        const response = await post(`/store/offer-carts/${cart.id}/items`, {
          offer_id: offerId,
          quantity: 1,
          ...override,
        });

        expect(response.status).toBe(400);
      });

      it('refreshes the price and stock of a part page live from the supplier', async () => {
        quote(1600, 7);

        const response = await api.get(
          `/store/part-identifiers/${identifierId}/offers`,
          storeHeaders,
        );

        expect(response.data.offers).toEqual([
          {
            id: offerId,
            price: 1920,
            currency: 'RSD',
            stock_quantity: 7,
            lead_time_days: 0,
          },
          {
            id: warehouseOfferId,
            price: 2200,
            currency: 'RSD',
            stock_quantity: 2,
            lead_time_days: 0,
          },
        ]);
      });

      it('drops a live quote in another currency than the shop sells in', async () => {
        intercars.quotes.set(ARTICLE, {
          article_id: ARTICLE,
          cost_price: 13,
          currency: 'EUR',
          stock: [{ location: 'Beograd', quantity: 5 }],
          lead_time_days: 0,
        });

        const response = await api.get(
          `/store/part-identifiers/${identifierId}/offers`,
          storeHeaders,
        );

        expect(
          response.data.offers.map(({ id }: { id: string }) => id),
        ).toEqual([warehouseOfferId]);
      });

      it('adds an offer at the price the supplier quotes live', async () => {
        const cart = await cartWith(2);

        expect(cart).toMatchObject({
          completed: false,
          currency: 'RSD',
          total: 3700,
          items: [
            {
              offer_id: offerId,
              quantity: 2,
              unit_price: 1850,
              available: true,
              part: {
                slug: 'bmw-11428575211',
                brand: 'BMW',
                number: '11 42 8575211',
                name: 'Oil filter',
              },
            },
          ],
        });
      });

      it('adds more of the same offer to its line', async () => {
        const cart = await cartWith(1);
        const response = await post(`/store/offer-carts/${cart.id}/items`, {
          offer_id: offerId,
          quantity: 2,
        });

        expect(response.data.cart.items).toHaveLength(1);
        expect(response.data.cart.items[0].quantity).toBe(3);
      });

      it('refuses to add more than the supplier has in stock', async () => {
        quote(1542, 1);
        const {
          data: { cart },
        } = await post('/store/offer-carts');

        const response = await post(`/store/offer-carts/${cart.id}/items`, {
          offer_id: offerId,
          quantity: 2,
        });

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('OFFER_OUT_OF_STOCK');
      });

      it('sells an offer of a supplier without an adapter at its stored price', async () => {
        const cart = await cartWith(1, warehouseOfferId);

        expect(cart.items[0].unit_price).toBe(2200);
      });

      it('sets the quantity of a line within what the supplier has', async () => {
        quote(1542, 3);
        const cart = await cartWith(1);
        const line = `/store/offer-carts/${cart.id}/items/${cart.items[0].id}`;

        const changed = await post(line, { quantity: 3 });
        expect(changed.data.cart.items[0].quantity).toBe(3);

        const refused = await post(line, { quantity: 4 });
        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('OFFER_OUT_OF_STOCK');
      });

      it('creates a cart holding the offer in one call', async () => {
        const created = await post('/store/offer-carts', {
          offer_id: offerId,
          quantity: 1,
        });

        expect(created.status).toBe(200);
        expect(created.data.cart.items).toEqual([
          expect.objectContaining({ offer_id: offerId, quantity: 1 }),
        ]);
      });

      it('creates no cart for an offer the supplier cannot sell', async () => {
        const carts = getContainer().resolve(Modules.CART);
        const before = await carts.listCarts({}, { select: ['id'] });

        const refused = await post('/store/offer-carts', {
          offer_id: offerId,
          quantity: 13,
        });

        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('OFFER_OUT_OF_STOCK');
        expect(await carts.listCarts({}, { select: ['id'] })).toHaveLength(
          before.length,
        );
      });

      it('removes a line', async () => {
        const cart = await cartWith(1);

        const response = await api
          .delete(
            `/store/offer-carts/${cart.id}/items/${cart.items[0].id}`,
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.data.cart.items).toEqual([]);
      });

      it('answers 404 for a cart that does not exist', async () => {
        const response = await post('/store/offer-carts/cart_missing/items', {
          offer_id: offerId,
          quantity: 1,
        });

        expect(response.status).toBe(404);
      });

      it('places the order with cash at pickup', async () => {
        const cart = await cartWith(1);

        const response = await complete(cart);

        expect(response.status).toBe(200);
        const order = await getContainer()
          .resolve(Modules.ORDER)
          .retrieveOrder(response.data.order.id, { relations: ['items'] });
        expect(Number(order.items?.[0].unit_price)).toBe(1850);
        expect(order.metadata).toMatchObject({
          fulfillment: 'cash_at_pickup',
          contact: '+381601234567',
          car: 'BMW 3 серия F30 320d, B47D20O0',
        });
        expect(
          (await post(`/store/offer-carts/${cart.id}/reprice`)).data.cart
            .completed,
        ).toBe(true);
      });

      it('refuses checkout without the fingerprint of the cart the visitor saw', async () => {
        const cart = await cartWith(1);

        const response = await post(
          `/store/offer-carts/${cart.id}/complete`,
          CONTACT,
        );

        expect(response.status).toBe(400);
      });

      it('names the car only from the VIN, never from what the visitor sent', async () => {
        const cart = await cartWith(1);

        const placed = await complete(cart, {
          ...CONTACT,
          vin: undefined,
          car: 'Forged car',
        });

        const order = await getContainer()
          .resolve(Modules.ORDER)
          .retrieveOrder(placed.data.order.id);
        expect(order.metadata?.car).toBeNull();
      });

      it('refuses checkout of a cart that changed since the visitor saw it', async () => {
        const shown = await cartWith(1);
        const changed = await post(`/store/offer-carts/${shown.id}/items`, {
          offer_id: offerId,
          quantity: 1,
        });

        const refused = await complete(shown, {
          ...CONTACT,
          cart_fingerprint: cartFingerprint(shown.items),
        });
        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('CART_CHANGED');

        const placed = await complete(shown, {
          ...CONTACT,
          cart_fingerprint: cartFingerprint(changed.data.cart.items),
        });
        expect(placed.status).toBe(200);
      });

      it('refuses an order without a contact', async () => {
        const cart = await cartWith(1);

        const response = await complete(cart, { name: 'Marko' });

        expect(response.status).toBe(400);
      });

      it('refuses a contact that is neither a phone number nor a Telegram handle', async () => {
        const cart = await cartWith(1);

        const response = await complete(cart, {
          ...CONTACT,
          contact: 'call me',
        });

        expect(response.status).toBe(400);
      });

      it('refuses a stale price and completes after a reprice', async () => {
        const cart = await cartWith(1);
        quote(1833, 12);

        const refused = await complete(cart);
        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('OFFER_PRICE_CHANGED');

        const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
        expect(repriced.data.cart.items[0].unit_price).toBe(2200);

        const placed = await complete(repriced.data.cart);
        expect(placed.status).toBe(200);
      });

      it('refuses checkout when the supplier no longer has enough in stock', async () => {
        const cart = await cartWith(2);
        quote(1542, 1);

        const refused = await complete(cart);

        expect(refused.data.code).toBe('OFFER_OUT_OF_STOCK');
        const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
        expect(repriced.data.cart.items[0].available).toBe(false);
      });

      it('refuses checkout when the supplier no longer quotes the offer', async () => {
        const cart = await cartWith(1);
        intercars.quotes.clear();

        const refused = await complete(cart);

        expect(refused.data.code).toBe('OFFER_MISSING');
      });

      it.each([
        [
          'change the metadata of',
          'post',
          (id: string) => `/store/carts/${id}`,
          { metadata: { offer_id: 'offer_forged' } },
        ],
        [
          'add a line to',
          'post',
          (id: string) => `/store/carts/${id}/line-items`,
          {
            variant_id: 'variant_forged',
            quantity: 50,
            metadata: { offer_id: 'offer_forged' },
          },
        ],
        [
          'change a line of',
          'post',
          (id: string, line: string) => `/store/carts/${id}/line-items/${line}`,
          { quantity: 50, metadata: { offer_id: 'offer_forged' } },
        ],
        [
          'remove a line of',
          'delete',
          (id: string, line: string) => `/store/carts/${id}/line-items/${line}`,
          undefined,
        ],
      ] as const)(
        'refuses the stock Medusa routes that %s an offer cart',
        async (_, method, path, body) => {
          const cart = await cartWith(1);
          const url = path(cart.id, cart.items[0].id);

          const refused = await (
            method === 'post'
              ? api.post(url, body, storeHeaders)
              : api.delete(url, storeHeaders)
          ).catch((error) => error.response);

          expect(refused.status).toBe(404);
          const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
          expect(repriced.data.cart.items).toEqual([
            expect.objectContaining({ offer_id: offerId, quantity: 1 }),
          ]);
        },
      );

      it('answers 404 for a line removed from an unknown cart', async () => {
        const response = await api
          .delete('/store/offer-carts/cart_DOESNOTEXIST/items/x', storeHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });

      it('answers 404 for a line that is not in the cart', async () => {
        const cart = await cartWith(1);

        const response = await api
          .delete(
            `/store/offer-carts/${cart.id}/items/cali_other`,
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });

      it('refuses the stock Medusa checkout of a cart without a contact', async () => {
        const cart = await cartWith(1);

        const refused = await post(`/store/carts/${cart.id}/complete`);

        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('CONTACT_MISSING');
      });

      it('hands a placed order to the lead pipeline', async () => {
        const cart = await cartWith(2);

        const placed = await complete(cart, {
          ...CONTACT,
          source_url: 'https://carlab.rs/sr/parts/cart/',
          visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
          ad_source: '{"utm_source":"google"}',
        });

        await waitFor(() => leads.length);
        expect(leads).toHaveLength(1);
        expect(leads[0]).toMatchObject({
          service: 'parts-order',
          contact: '+381601234567',
          contact_channel: 'whatsapp',
          name: 'Marko',
          vin: 'WBA35BG070N074158',
          locale: 'sr',
          consent: '1',
          source_url: 'https://carlab.rs/sr/parts/cart/',
          visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
          ad_source: '{"utm_source":"google"}',
        });
        expect(leads[0].comment).toBe(
          [
            `Заказ #${placed.data.order.display_id}, самовывоз, оплата при получении`,
            'Нужно подтвердить наличие и время самовывоза',
            'BMW 3 серия F30 320d, B47D20O0',
            'Oil filter (BMW 11 42 8575211) × 2: 3\u00a0700 RSD',
            'Итого: 3\u00a0700 RSD',
            'Pozvati posle 17h',
          ].join('\n'),
        );
      });

      describe('an add-on service sold with a line', () => {
        const SERVICE = 'Регистрация аккумулятора в блоке управления';
        let batteryOfferId: string;
        let serviceCategoryId: string;

        beforeEach(async () => {
          const container = getContainer();
          const catalog: CatalogModuleService =
            container.resolve(CATALOG_MODULE);
          const suppliers: SupplierModuleService =
            container.resolve(SUPPLIER_MODULE);
          const [varta] = await catalog.createBrands([
            { name: 'Varta', slug: 'varta' },
          ]);
          const category = await catalog.createCategories({
            slug: 'batteries',
            name: 'Аккумуляторы',
            service_label: SERVICE,
            service_price: 2500,
          });
          serviceCategoryId = category.id;
          const part = await catalog.createParts({
            name: 'Аккумулятор AGM 80 Ач',
            category_id: category.id,
          });
          const identifier = await catalog.createPartIdentifiers({
            part_id: part.id,
            type: 'manufacturer-number',
            brand_id: varta.id,
            value: '580 901 080',
            normalized_value: normalizePartNumber('580 901 080'),
          });
          const shop = await suppliers.createSuppliers({
            name: 'Battery shop',
            markup_percentage: 0,
          });
          const offer = await suppliers.createSupplierOffers({
            part_identifier_id: identifier.id,
            supplier_id: shop.id,
            supplier_article_id: 'BAT-1',
            cost_price: 10000,
            stock_quantity: 5,
            lead_time_days: 0,
          });
          batteryOfferId = offer.id;
        });

        const addonPath = (cart: { id: string; items: { id: string }[] }) =>
          `/store/offer-carts/${cart.id}/items/${cart.items[0].id}/addon`;

        const batteryCart = async () => {
          const cart = await cartWith(1, batteryOfferId);
          const added = await post(addonPath(cart));
          expect(added.status).toBe(200);
          return added.data.cart;
        };

        it('offers the add-on of the Category on its lines only', async () => {
          const battery = await cartWith(1, batteryOfferId);
          const oil = await cartWith(1);

          expect(battery.items[0].addon).toEqual({
            item_id: null,
            label: SERVICE,
            translations: null,
            unit_price: 2500,
          });
          expect(oil.items[0].addon).toBeNull();
          expect((await post(addonPath(oil))).status).toBe(400);
        });

        it('adds the add-on once, at the price the Category sets', async () => {
          const cart = await batteryCart();
          const again = (await post(addonPath(cart))).data.cart;

          expect(again.items).toHaveLength(1);
          expect(again.items[0].addon).toMatchObject({
            item_id: expect.any(String),
            unit_price: 2500,
          });
          expect(again.total).toBe(12500);
        });

        it('refuses a price sent with the add-on', async () => {
          const cart = await cartWith(1, batteryOfferId);

          const forged = await post(addonPath(cart), { unit_price: 1 });

          expect(forged.status).toBe(400);
          const shown = await post(`/store/offer-carts/${cart.id}/reprice`);
          expect(shown.data.cart.items[0].addon.item_id).toBeNull();
          expect(shown.data.cart.total).toBe(10000);
        });

        it('takes the add-on off a line', async () => {
          const cart = await batteryCart();

          const removed = await api
            .delete(addonPath(cart), storeHeaders)
            .catch((error) => error.response);

          expect(removed.data.cart.items[0].addon.item_id).toBeNull();
          expect(removed.data.cart.total).toBe(10000);
        });

        it('removes the add-on together with its line', async () => {
          const cart = await batteryCart();

          await api.delete(
            `/store/offer-carts/${cart.id}/items/${cart.items[0].id}`,
            storeHeaders,
          );
          const withOil = (
            await post(`/store/offer-carts/${cart.id}/items`, {
              offer_id: offerId,
              quantity: 1,
            })
          ).data.cart;
          const placed = await complete(withOil);

          const order = await getContainer()
            .resolve(Modules.ORDER)
            .retrieveOrder(placed.data.order.id, { relations: ['items'] });
          expect(order.items?.map(({ title }) => title)).toEqual([
            'Oil filter (BMW 11 42 8575211)',
          ]);
        });

        it('refuses checkout with an add-on priced before the Category changed it', async () => {
          const cart = await batteryCart();
          const catalog: CatalogModuleService =
            getContainer().resolve(CATALOG_MODULE);
          await catalog.updateCategories({
            id: serviceCategoryId,
            service_price: 3000,
          });

          const refused = await complete(cart);
          expect(refused.status).toBe(400);
          expect(refused.data.code).toBe('OFFER_PRICE_CHANGED');

          const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
          expect(repriced.data.cart.items[0].addon.unit_price).toBe(3000);
          expect((await complete(repriced.data.cart)).status).toBe(200);
        });

        it('refuses checkout with an add-on the Category no longer sells', async () => {
          const cart = await batteryCart();
          const catalog: CatalogModuleService =
            getContainer().resolve(CATALOG_MODULE);
          await catalog.updateCategories({
            id: serviceCategoryId,
            service_label: null,
            service_price: null,
          });

          const refused = await complete(cart);

          expect(refused.data.code).toBe('OFFER_MISSING');
          const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
          expect(repriced.data.cart.items[0].addon).toBeNull();
          expect(repriced.data.cart.total).toBe(10000);
        });

        it('lists the add-on as its own line of the order lead', async () => {
          const cart = await batteryCart();

          const placed = await complete(cart);

          const lead = await waitFor(() =>
            leads.find(({ comment }) =>
              comment.startsWith(`Заказ #${placed.data.order.display_id},`),
            ),
          );
          expect(lead?.comment.split('\n').slice(3, 6)).toEqual([
            'Аккумулятор AGM 80 Ач (Varta 580 901 080) × 1: 10\u00a0000 RSD',
            `+ ${SERVICE}: 2\u00a0500 RSD`,
            'Итого: 12\u00a0500 RSD',
          ]);
          expect(placed.status).toBe(200);
        });
      });

      it('records on the order that the lead route refused it', async () => {
        leadRouteStatus = 500;
        const cart = await cartWith(1);

        const placed = await complete(cart);

        const orders = getContainer().resolve(Modules.ORDER);
        const metadata = await waitFor(
          async () =>
            (await orders.retrieveOrder(placed.data.order.id)).metadata?.[
              LEAD_HANDOFF_ERROR
            ],
        );
        expect(metadata).toBe('The lead route answered 500');
      });

      const leadsFor = (placed: { data: { order: { display_id: number } } }) =>
        leads.filter(({ comment }) =>
          comment.startsWith(`Заказ #${placed.data.order.display_id},`),
        );

      it('re-sends a refused order once the lead route answers again', async () => {
        leadRouteStatus = 500;
        const placed = await complete(await cartWith(1));
        const orders = getContainer().resolve(Modules.ORDER);
        const refused = () => orders.retrieveOrder(placed.data.order.id);
        await waitFor(
          async () => (await refused()).metadata?.[LEAD_HANDOFF_ERROR],
        );
        leads.length = 0;
        leadRouteStatus = 302;

        await retryOrderLeads(getContainer());

        expect(leadsFor(placed)).toHaveLength(1);
        expect((await refused()).metadata?.[LEAD_HANDOFF_ERROR]).toBeFalsy();
        await retryOrderLeads(getContainer());
        expect(leadsFor(placed)).toHaveLength(1);
      });

      it('stops re-sending an order the lead route keeps refusing', async () => {
        leadRouteStatus = 400;
        const placed = await complete(await cartWith(1));
        const orders = getContainer().resolve(Modules.ORDER);
        await waitFor(
          async () =>
            (await orders.retrieveOrder(placed.data.order.id)).metadata?.[
              LEAD_HANDOFF_ERROR
            ],
        );

        for (let run = 0; run < 15; run += 1) {
          await retryOrderLeads(getContainer());
        }

        expect(leadsFor(placed)).toHaveLength(LEAD_HANDOFF_MAX_ATTEMPTS);
      });
    });
  },
});
