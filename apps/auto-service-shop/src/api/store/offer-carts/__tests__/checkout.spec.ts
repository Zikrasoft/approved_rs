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
import retryOrderLeads, {
  retryOrderLeadsAt,
} from '../../../../jobs/retry-order-leads';
import {
  LEAD_HANDED_OFF_AT,
  LEAD_HANDOFF_ERROR,
  LEAD_HANDOFF_MAX_ATTEMPTS,
} from '../../../../lib/order-lead';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const intercars = createFakeSupplier('Intercars');
const ARTICLE = 'IC-11428575211';

const quote = (cost_price: number, quantity: number, lead_time_days = 0) =>
  intercars.quotes.set(ARTICLE, {
    article_id: ARTICLE,
    cost_price,
    currency: 'RSD',
    stock: [{ location: 'Beograd', quantity }],
    lead_time_days,
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

const SHOP_LEAD_SECRET = 'shop-lead-secret';

const settled = () => new Date(Date.now() + 5 * 60 * 1000);

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
      const authorizations: (string | undefined)[] = [];
      let leadRouteStatus = 302;

      beforeAll(async () => {
        leadRoute = createServer((request, response) => {
          let body = '';
          request.on('data', (chunk) => (body += chunk));
          request.on('end', () => {
            leads.push(Object.fromEntries(new URLSearchParams(body)));
            authorizations.push(request.headers.authorization);
            response
              .writeHead(leadRouteStatus, { location: '/sr/thanks/' })
              .end();
          });
        });
        await new Promise<void>((resolve) => leadRoute.listen(0, resolve));
        process.env.LEAD_ROUTE_URL = `http://localhost:${(leadRoute.address() as AddressInfo).port}/api/leads`;
        process.env.SHOP_LEAD_SECRET = SHOP_LEAD_SECRET;

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
        authorizations.length = 0;
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
        delete process.env.SHOP_LEAD_SECRET;
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
        ['an offer id no offer has', { offer_id: 'x'.repeat(65) }],
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
              in_stock: true,
              lead_time_days: 0,
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

      it('takes a double tap on add as two adds, not an error', async () => {
        const {
          data: { cart },
        } = await post('/store/offer-carts');

        const added = await Promise.all(
          Array.from({ length: 4 }, () =>
            post(`/store/offer-carts/${cart.id}/items`, {
              offer_id: offerId,
              quantity: 1,
            }),
          ),
        );

        expect(added.map(({ status }) => status)).toEqual([200, 200, 200, 200]);
        const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
        expect(repriced.data.cart.items).toEqual([
          expect.objectContaining({ offer_id: offerId, quantity: 4 }),
        ]);
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

      it('sells an offer the supplier has no stock of but can bring in', async () => {
        quote(1542, 0, 4);

        const cart = await cartWith(2);

        expect(cart.items[0]).toMatchObject({
          quantity: 2,
          available: true,
          in_stock: false,
          lead_time_days: 4,
          max_quantity: 10,
        });
      });

      it('caps an offer the supplier only brings in at ten', async () => {
        quote(1542, 0, 4);
        const cart = await cartWith(10);

        const refused = await post(
          `/store/offer-carts/${cart.id}/items/${cart.items[0].id}`,
          { quantity: 11 },
        );

        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('OFFER_OUT_OF_STOCK');
      });

      it('refuses an offer with neither stock nor a lead time', async () => {
        quote(1542, 0, 0);

        const refused = await post('/store/offer-carts', {
          offer_id: offerId,
          quantity: 1,
        });

        expect(refused.status).toBe(400);
        expect(refused.data.code).toBe('OFFER_OUT_OF_STOCK');
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

      describe('while the shop is closed', () => {
        const postPreview = (path: string, body: unknown = {}) =>
          api
            .post(path, body, {
              headers: { ...storeHeaders.headers, 'x-shop-preview': '1' },
            })
            .catch((error) => error.response);

        beforeAll(() => {
          process.env.SHOP_OPEN = 'false';
        });

        afterAll(() => {
          delete process.env.SHOP_OPEN;
        });

        it('refuses a cart to a visitor without the preview flag', async () => {
          const refused = await post('/store/offer-carts', {
            offer_id: offerId,
            quantity: 1,
          });

          expect(refused.status).toBe(403);
        });

        it('sells to a visitor with the preview flag', async () => {
          const created = await postPreview('/store/offer-carts', {
            offer_id: offerId,
            quantity: 1,
          });

          expect(created.status).toBe(200);
          expect(
            (
              await postPreview(
                `/store/offer-carts/${created.data.cart.id}/items`,
                { offer_id: offerId, quantity: 1 },
              )
            ).status,
          ).toBe(200);
        });

        it('refuses checkout to a visitor without the preview flag', async () => {
          const {
            data: { cart },
          } = await postPreview('/store/offer-carts', {
            offer_id: offerId,
            quantity: 1,
          });

          expect(
            (
              await post(`/store/offer-carts/${cart.id}/items`, {
                offer_id: offerId,
                quantity: 1,
              })
            ).status,
          ).toBe(403);
          expect((await complete(cart)).status).toBe(403);
        });

        it('refuses every change to a cart without the preview flag', async () => {
          const {
            data: { cart },
          } = await postPreview('/store/offer-carts', {
            offer_id: offerId,
            quantity: 1,
          });
          const line = `/store/offer-carts/${cart.id}/items/${cart.items[0].id}`;
          const remove = (path: string) =>
            api.delete(path, storeHeaders).catch((error) => error.response);

          expect((await post(line, { quantity: 2 })).status).toBe(403);
          expect((await post(`${line}/addon`)).status).toBe(403);
          expect((await remove(`${line}/addon`)).status).toBe(403);
          expect((await post(`${line}/installation`)).status).toBe(403);
          expect((await remove(`${line}/installation`)).status).toBe(403);
          expect((await remove(line)).status).toBe(403);
          expect(
            (await post(`/store/offer-carts/${cart.id}/reprice`)).status,
          ).toBe(403);
        });
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

      it('never orders a line added while the checkout runs', async () => {
        for (let run = 0; run < 3; run += 1) {
          const cart = await cartWith(1);

          const [placed] = await Promise.all([
            complete(cart),
            post(`/store/offer-carts/${cart.id}/items`, {
              offer_id: warehouseOfferId,
              quantity: 1,
            }),
          ]);

          if (placed.status === 200) {
            const order = await getContainer()
              .resolve(Modules.ORDER)
              .retrieveOrder(placed.data.order.id, { relations: ['items'] });
            expect(order.items).toHaveLength(1);
          } else {
            expect(placed.data.code).toBe('CART_CHANGED');
          }
        }
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

      it('keeps the order of the lines when a reprice changes the first one', async () => {
        const cart = await cartWith(1);
        await post(`/store/offer-carts/${cart.id}/items`, {
          offer_id: warehouseOfferId,
          quantity: 1,
        });
        quote(1833, 12);

        const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);

        expect(
          repriced.data.cart.items.map(
            ({ offer_id }: { offer_id: string }) => offer_id,
          ),
        ).toEqual([offerId, warehouseOfferId]);
      });

      it('refuses checkout when the supplier no longer has enough in stock', async () => {
        const cart = await cartWith(2);
        quote(1542, 1);

        const refused = await complete(cart);

        expect(refused.data.code).toBe('OFFER_OUT_OF_STOCK');
        const repriced = await post(`/store/offer-carts/${cart.id}/reprice`);
        expect(repriced.data.cart.items[0].available).toBe(false);
      });

      it('completes a line that ran out of stock while the supplier can still bring it in', async () => {
        const cart = await cartWith(2);
        quote(1542, 0, 4);

        const placed = await complete(cart);

        expect(placed.status).toBe(200);
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

      it('refuses a cart for an email whose local part is longer than 64 characters', async () => {
        const response = await post('/store/offer-carts', {
          email: `${'a'.repeat(65)}@b.co`,
        });

        expect(response.status).toBe(400);
      });

      it('refuses the stock Medusa routes a shop without accounts or returns never uses', async () => {
        const cart = await cartWith(1);

        const refused = await Promise.all(
          [
            api.get(`/store/carts/${cart.id}`, storeHeaders),
            api.post('/store/returns', {}, storeHeaders),
            api.get('/store/customers/me', storeHeaders),
            api.post('/store/customers', {}, storeHeaders),
            api.post('/auth/customer/emailpass/register', {
              email: 'spam@example.com',
              password: 'spam-spam-spam',
            }),
          ].map((request) => request.catch((error) => error.response)),
        );

        expect(refused.map(({ status }) => status)).toEqual([
          404, 404, 404, 404, 404,
        ]);
      });

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

      it('refuses the stock Medusa checkout, which skips the fingerprint and the closed shop', async () => {
        const cart = await cartWith(1);
        const carts = getContainer().resolve(Modules.CART);
        await carts.updateCarts(cart.id, {
          metadata: { ...CONTACT, fulfillment: 'cash_at_pickup' },
        });

        const refused = await post(`/store/carts/${cart.id}/complete`);
        const collection = await post('/store/payment-collections', {
          cart_id: cart.id,
        });

        expect([refused.status, collection.status]).toEqual([404, 404]);
        expect((await carts.retrieveCart(cart.id)).completed_at).toBeFalsy();
      });

      it('keeps the contact of a placed order when its cart is checked out again', async () => {
        const cart = await cartWith(1);
        const placed = await complete(cart);

        const again = await complete(cart, {
          ...CONTACT,
          contact: '+381609999999',
          name: 'Second',
        });

        expect(again.status).toBe(200);
        expect(again.data.order.id).toBe(placed.data.order.id);
        const { metadata } = await getContainer()
          .resolve(Modules.CART)
          .retrieveCart(cart.id);
        expect(metadata).toMatchObject({
          contact: CONTACT.contact,
          name: CONTACT.name,
        });
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
        expect(authorizations).toEqual([`Bearer ${SHOP_LEAD_SECRET}`]);
        expect(leads[0]).toMatchObject({
          order_id: placed.data.order.id,
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
            'Oil filter (BMW 11 42 8575211) × 2: 3\u00a0700 RSD, в наличии, Intercars',
            'Итого: 3\u00a0700 RSD',
            'Pozvati posle 17h',
          ].join('\n'),
        );
      });

      it('tells the owner when a line can be picked up', async () => {
        quote(1542, 0, 4);
        const cart = await cartWith(2);

        const placed = await complete(cart);

        const lead = await waitFor(() =>
          leads.find(({ comment }) =>
            comment.startsWith(`Заказ #${placed.data.order.display_id},`),
          ),
        );
        expect(lead?.comment.split('\n')[3]).toBe(
          'Oil filter (BMW 11 42 8575211) × 2: 3\u00a0700 RSD, забрать через 4 дня, Intercars',
        );
      });

      describe('an add-on service sold with a line', () => {
        const SERVICE = 'Регистрация аккумулятора в блоке управления';
        let batteryOfferId: string;
        let serviceCategoryId: string;
        let batteryPartId: string;

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
            installation_price: 1500,
          });
          serviceCategoryId = category.id;
          const part = await catalog.createParts({
            name: 'Аккумулятор AGM 80 Ач',
            category_id: category.id,
          });
          batteryPartId = part.id;
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

        const cartLines = async (cartId: string) =>
          (
            await getContainer()
              .resolve(Modules.CART)
              .retrieveCart(cartId, { relations: ['items'] })
          ).items ?? [];

        it('names the parent line on an add-on, so the previous image still reads it', async () => {
          const cart = await batteryCart();

          const lines = await cartLines(cart.id);
          const parent = lines.find(({ metadata }) => metadata?.offer_id);
          const addon = lines.find(({ id }) => id !== parent?.id);
          expect(addon?.metadata).toMatchObject({
            addon_for: parent?.id,
            addon_offer_id: batteryOfferId,
          });
        });

        it('keeps an add-on written by the previous image, which names only the parent line', async () => {
          const cart = await cartWith(1, batteryOfferId);
          await getContainer()
            .resolve(Modules.CART)
            .addLineItems({
              cart_id: cart.id,
              title: SERVICE,
              quantity: 1,
              unit_price: 2500,
              requires_shipping: false,
              metadata: { addon_for: cart.items[0].id },
            });

          const repriced = (await post(`/store/offer-carts/${cart.id}/reprice`))
            .data.cart;

          expect(repriced.items[0].addon).toMatchObject({
            item_id: expect.any(String),
            unit_price: 2500,
          });
          expect(repriced.total).toBe(12500);
          expect(await cartLines(cart.id)).toHaveLength(2);
        });

        it('charges the add-on for every unit of its line', async () => {
          const two = await cartWith(2, batteryOfferId);
          const added = (await post(addonPath(two))).data.cart;
          expect(added.total).toBe(2 * 10000 + 2 * 2500);

          const three = (
            await post(
              `/store/offer-carts/${two.id}/items/${two.items[0].id}`,
              { quantity: 3 },
            )
          ).data.cart;
          expect(three.total).toBe(3 * 10000 + 3 * 2500);

          const placed = await complete(three);
          expect(placed.status).toBe(200);
          const order = await getContainer()
            .resolve(Modules.ORDER)
            .retrieveOrder(placed.data.order.id, { relations: ['items'] });
          expect(
            order.items?.map(({ title, quantity }) => [
              title,
              Number(quantity),
            ]),
          ).toEqual(expect.arrayContaining([[SERVICE, 3]]));
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
            'Аккумулятор AGM 80 Ач (Varta 580 901 080) × 1: 10\u00a0000 RSD, в наличии, Battery shop',
            `+ ${SERVICE}: 2\u00a0500 RSD`,
            'Итого: 12\u00a0500 RSD',
          ]);
          expect(placed.status).toBe(200);
        });

        describe('installation at CarLab', () => {
          const installPath = (cart: { id: string; items: { id: string }[] }) =>
            `/store/offer-carts/${cart.id}/items/${cart.items[0].id}/installation`;

          const setPart = (update: {
            installation_price?: number | null;
            no_installation?: boolean;
          }) =>
            getContainer()
              .resolve<CatalogModuleService>(CATALOG_MODULE)
              .updateParts({ id: batteryPartId, ...update });

          it('offers installation at the price the Category sets, and none where nothing sets one', async () => {
            const battery = await cartWith(1, batteryOfferId);
            const oil = await cartWith(1);

            expect(battery.items[0].installation).toEqual({
              item_id: null,
              unit_price: 1500,
            });
            expect(oil.items[0].installation).toBeNull();
            expect((await post(installPath(oil))).status).toBe(400);
          });

          it('takes the price the Part sets over the Category, free included', async () => {
            await setPart({ installation_price: 0 });

            const cart = (
              await post(installPath(await cartWith(2, batteryOfferId)))
            ).data.cart;

            expect(cart.items[0].installation).toEqual({
              item_id: expect.any(String),
              unit_price: 0,
            });
            expect(cart.total).toBe(20000);
            expect((await complete(cart)).status).toBe(200);
          });

          it('offers no installation on a Part that refuses it', async () => {
            await setPart({ no_installation: true });

            const cart = await cartWith(1, batteryOfferId);

            expect(cart.items[0].installation).toBeNull();
            expect((await post(installPath(cart))).status).toBe(400);
          });

          it('adds installation beside the add-on service, each charged per unit', async () => {
            const two = await cartWith(2, batteryOfferId);
            await post(addonPath(two));
            const both = (await post(installPath(two))).data.cart;
            expect(both.items).toHaveLength(1);
            expect(both.total).toBe(2 * 10000 + 2 * 2500 + 2 * 1500);

            const again = (await post(installPath(two))).data.cart;
            expect(again.total).toBe(both.total);

            const removed = (
              await api
                .delete(installPath(two), storeHeaders)
                .catch((error) => error.response)
            ).data.cart;
            expect(removed.items[0].installation.item_id).toBeNull();
            expect(removed.items[0].addon.item_id).toEqual(expect.any(String));
            expect(removed.total).toBe(2 * 10000 + 2 * 2500);
          });

          it('refuses a price sent with installation', async () => {
            const cart = await cartWith(1, batteryOfferId);

            expect(
              (await post(installPath(cart), { unit_price: 1 })).status,
            ).toBe(400);
          });

          it('refuses checkout with installation priced before the Part changed it', async () => {
            const cart = (
              await post(installPath(await cartWith(1, batteryOfferId)))
            ).data.cart;
            await setPart({ installation_price: 2000 });

            const refused = await complete(cart);
            expect(refused.data.code).toBe('OFFER_PRICE_CHANGED');

            const repriced = await post(
              `/store/offer-carts/${cart.id}/reprice`,
            );
            expect(repriced.data.cart.items[0].installation.unit_price).toBe(
              2000,
            );
            expect((await complete(repriced.data.cart)).status).toBe(200);
          });

          it('refuses checkout with installation the Part no longer offers', async () => {
            const cart = (
              await post(installPath(await cartWith(1, batteryOfferId)))
            ).data.cart;
            await setPart({ no_installation: true });

            expect((await complete(cart)).data.code).toBe('OFFER_MISSING');
            const repriced = await post(
              `/store/offer-carts/${cart.id}/reprice`,
            );
            expect(repriced.data.cart.items[0].installation).toBeNull();
            expect(repriced.data.cart.total).toBe(10000);
          });

          it('prints both add-ons under the battery line of the order lead, not under the line before it', async () => {
            const cart = await cartWith(1);
            const withBattery = (
              await post(`/store/offer-carts/${cart.id}/items`, {
                offer_id: batteryOfferId,
                quantity: 1,
              })
            ).data.cart;
            const battery = withBattery.items.find(
              ({ offer_id }: { offer_id: string }) =>
                offer_id === batteryOfferId,
            );
            const line = `/store/offer-carts/${cart.id}/items/${battery.id}`;
            await post(`${line}/installation`);
            const ready = (await post(`${line}/addon`)).data.cart;

            const placed = await complete(ready);

            const lead = await waitFor(() =>
              leads.find(({ comment }) =>
                comment.startsWith(`Заказ #${placed.data.order.display_id},`),
              ),
            );
            const lines = lead?.comment.split('\n') ?? [];
            const varta = lines.findIndex((text) => text.includes('Varta'));
            expect(lines.slice(varta + 1, varta + 3)).toEqual([
              `+ ${SERVICE}: 2\u00a0500 RSD`,
              '+ Установка в сервисе CarLab: 1\u00a0500 RSD',
            ]);
          });
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

        await retryOrderLeadsAt(getContainer(), settled());

        expect(leadsFor(placed)).toHaveLength(1);
        expect((await refused()).metadata?.[LEAD_HANDOFF_ERROR]).toBeFalsy();
        await retryOrderLeadsAt(getContainer(), settled());
        expect(leadsFor(placed)).toHaveLength(1);
      });

      it('re-sends an order whose placed event never reached the subscriber', async () => {
        const placed = await complete(await cartWith(1));
        const orders = getContainer().resolve(Modules.ORDER);
        const order = () => orders.retrieveOrder(placed.data.order.id);
        await waitFor(
          async () => (await order()).metadata?.[LEAD_HANDED_OFF_AT],
        );
        const { metadata } = await order();
        await orders.updateOrders(placed.data.order.id, {
          metadata: { ...metadata, [LEAD_HANDED_OFF_AT]: '' },
        });
        leads.length = 0;

        await retryOrderLeads(getContainer());
        expect(leadsFor(placed)).toHaveLength(0);

        await retryOrderLeadsAt(getContainer(), settled());
        expect(leadsFor(placed)).toEqual([
          expect.objectContaining({ order_id: placed.data.order.id }),
        ]);
        await retryOrderLeadsAt(getContainer(), settled());
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
          await retryOrderLeadsAt(getContainer(), settled());
        }

        expect(leadsFor(placed)).toHaveLength(LEAD_HANDOFF_MAX_ATTEMPTS);
      });
    });
  },
});
