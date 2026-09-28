import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { WORKSHOP_ADDRESS } from '@podbor/brands';
import { PRODUCT_TYPES, SERVICE_TYPE } from '@podbor/shop-catalog';

import {
  INSTALLATION_SEED_PRICE,
  INSTALLATION_TITLES,
  SHOP,
} from '../../src/lib/shop';
import { seedBase } from '../../src/scripts/seed-base';
import { storeHeaders } from './store-context';

jest.setTimeout(180_000);

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const seed = () =>
      seedBase(
        getContainer(),
        getContainer().resolve(ContainerRegistrationKeys.LOGGER),
      );

    beforeAll(seed);

    const state = async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
      const graph = async (
        entity: string,
        fields: string[],
        filters?: Record<string, unknown>,
      ) => (await query.graph({ entity, fields, filters })).data;

      const [store] = await graph('store', [
        'supported_currencies.currency_code',
        'supported_currencies.is_default',
        'supported_locales.locale_code',
        'default_region_id',
        'default_location_id',
        'default_sales_channel_id',
      ]);

      return {
        store,
        regions: await graph('region', [
          'name',
          'currency_code',
          'countries.iso_2',
          'payment_providers.id',
        ]),
        taxRegions: await graph('tax_region', ['country_code', 'provider_id']),
        channels: (await graph('sales_channel', ['name'])).filter(
          (channel) => channel.name === SHOP.salesChannelName,
        ).length,
        keys: (await graph('api_key', ['title', 'type', 'revoked_at'])).filter(
          (key) =>
            key.type === 'publishable' &&
            key.title === SHOP.publishableKeyTitle,
        ).length,
        locations: await graph('stock_location', [
          'name',
          'address.address_1',
          'address.city',
          'address.country_code',
          'fulfillment_sets.type',
          'fulfillment_providers.id',
        ]),
        options: await graph('shipping_option', [
          'name',
          'provider_id',
          'type.code',
          'prices.amount',
          'prices.currency_code',
        ]),
        types: (await graph('product_type', ['value']))
          .map((type) => type.value)
          .sort(),
        services: await graph(
          'product',
          [
            'handle',
            'status',
            'type.value',
            'variants.sku',
            'variants.manage_inventory',
            'variants.prices.amount',
            'variants.prices.currency_code',
          ],
          { handle: Object.keys(INSTALLATION_TITLES) },
        ),
        serbian: (
          await getContainer()
            .resolve(Modules.TRANSLATION)
            .listLocales({ code: 'sr-RS' })
        ).length,
      };
    };

    it('builds the Serbian pickup shop once, however many times it runs', async () => {
      const first = await state();
      await seed();

      expect(await state()).toEqual(first);

      expect(first.regions).toEqual([
        expect.objectContaining({
          name: 'Srbija',
          currency_code: 'rsd',
          countries: [expect.objectContaining({ iso_2: 'rs' })],
          payment_providers: [
            expect.objectContaining({ id: 'pp_system_default' }),
          ],
        }),
      ]);
      expect(first.taxRegions).toEqual([
        expect.objectContaining({
          country_code: 'rs',
          provider_id: 'tp_system',
        }),
      ]);
      expect(first.channels).toBe(1);
      expect(first.keys).toBe(1);
      expect(first.locations).toEqual([
        expect.objectContaining({
          name: 'CarLab',
          address: expect.objectContaining({
            address_1: WORKSHOP_ADDRESS.street,
            city: WORKSHOP_ADDRESS.city,
            country_code: 'rs',
          }),
          fulfillment_sets: [expect.objectContaining({ type: 'pickup' })],
          fulfillment_providers: [
            expect.objectContaining({ id: 'manual_manual' }),
          ],
        }),
      ]);
      expect(first.options).toEqual([
        expect.objectContaining({
          name: 'Самовывоз',
          provider_id: 'manual_manual',
          type: expect.objectContaining({ code: 'pickup' }),
          prices: [
            expect.objectContaining({ amount: 0, currency_code: 'rsd' }),
          ],
        }),
      ]);
      expect(first.types).toEqual(
        [...PRODUCT_TYPES.map((type) => type.key), SERVICE_TYPE].sort(),
      );
      expect(first.store.supported_currencies).toEqual([
        expect.objectContaining({ currency_code: 'rsd', is_default: true }),
      ]);
      expect(
        first.store.supported_locales
          .map((locale: { locale_code: string }) => locale.locale_code)
          .sort(),
      ).toEqual(['en-US', 'ru-RU', 'sr-RS']);
      expect(first.serbian).toBe(1);

      expect(first.services).toHaveLength(2);
      for (const service of first.services) {
        expect(service).toMatchObject({
          status: 'published',
          type: { value: SERVICE_TYPE },
        });
        expect(service.variants).toEqual([
          expect.objectContaining({
            sku: service.handle.toUpperCase(),
            manage_inventory: false,
            prices: [
              expect.objectContaining({
                amount: INSTALLATION_SEED_PRICE,
                currency_code: 'rsd',
              }),
            ],
          }),
        ]);
      }
    });

    it('shows the storefront one region in dinars, paid on collection', async () => {
      const headers = await storeHeaders(getContainer);

      const { data } = await api.get('/store/regions', { headers });
      expect(data.regions).toHaveLength(1);
      expect(data.regions[0]).toMatchObject({ currency_code: 'rsd' });

      const { data: providers } = await api.get(
        `/store/payment-providers?region_id=${data.regions[0].id}`,
        { headers },
      );
      expect(
        providers.payment_providers.map(
          (provider: { id: string }) => provider.id,
        ),
      ).toEqual(['pp_system_default']);
    });
  },
});
