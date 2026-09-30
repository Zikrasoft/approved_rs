import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from '@medusajs/framework/utils';
import {
  batchTranslationsWorkflow,
  createProductsWorkflow,
  createTranslationsWorkflow,
} from '@medusajs/medusa/core-flows';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { sourceHash, productSource } from '../../src/lib/product-source';
import { DEFAULT_OPTION, SHOP } from '../../src/lib/shop';
import { BATTERIES } from '../../src/scripts/battery-fixture';
import seedBatteries from '../../src/scripts/seed-batteries';
import { adminHeaders } from './admin-session';
import { storeHeaders } from './store-context';

jest.setTimeout(180_000);

const BOSCH = BATTERIES.find((battery) => battery.handle === 'bosch-s4-024')!;
const EXIDE = BATTERIES.find(
  (battery) => battery.handle === 'exide-agm-ek950',
)!;

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const seed = () => seedBatteries({ container: getContainer() } as never);

    beforeAll(seed);

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY);

    const storeProduct = async (search: string, headers: object) => {
      const { data } = await api.get(`/store/products?${search}`, { headers });
      return data.products[0];
    };

    const stockOf = async (sku: string): Promise<number | undefined> => {
      const { data } = await query().graph({
        entity: 'product_variant',
        fields: [
          'sku',
          'inventory_items.inventory.location_levels.stocked_quantity',
        ],
        filters: { sku },
      });
      return data[0].inventory_items?.[0]?.inventory?.location_levels?.[0]
        ?.stocked_quantity;
    };

    it('seeds every battery once, with its spec, hash and stock, however many times it runs', async () => {
      await seed();

      const { data } = await query().graph({
        entity: 'product',
        fields: ['handle', 'metadata', 'type.value', 'thumbnail'],
        filters: { handle: BATTERIES.map((battery) => battery.handle) },
      });
      expect(data).toHaveLength(BATTERIES.length);

      const bosch = data.find((row) => row.handle === BOSCH.handle)!;
      expect(bosch.type?.value).toBe('batteries');
      expect(bosch.thumbnail).toMatch(/^http:\/\/localhost:9009\/static\//);
      expect(bosch.metadata).toEqual({
        spec: BOSCH.spec,
        fitment: BOSCH.fitment,
        translated_from_sr: sourceHash(productSource(BOSCH)),
        translated_from_en: sourceHash(productSource(BOSCH)),
      });
      expect(await stockOf('BOSCH-S4-024')).toBe(BOSCH.stock);
      expect(await stockOf('EXIDE-AGM-EK950')).toBe(EXIDE.stock);
    });

    it('restores a deleted translation and inventory level on rerun, without touching the rest', async () => {
      const container = getContainer();
      const {
        data: [bosch],
      } = await query().graph({
        entity: 'product',
        fields: ['id'],
        filters: { handle: BOSCH.handle },
      });
      const translation = container.resolve(Modules.TRANSLATION);
      const [serbian] = await translation.listTranslations({
        reference: 'product',
        reference_id: bosch.id,
        locale_code: 'sr-RS',
      });
      await batchTranslationsWorkflow(container).run({
        input: { create: [], update: [], delete: [serbian.id] },
      });

      const {
        data: [variant],
      } = await query().graph({
        entity: 'product_variant',
        fields: ['inventory_items.inventory_item_id'],
        filters: { sku: 'BOSCH-S4-024' },
      });
      const itemId = variant.inventory_items![0]!.inventory_item_id;
      const {
        data: [level],
      } = await query().graph({
        entity: 'inventory_level',
        fields: ['location_id'],
        filters: { inventory_item_id: itemId },
      });
      const inventory = container.resolve(Modules.INVENTORY);
      await inventory.deleteInventoryLevel(itemId, level.location_id);

      expect(
        await translation.listTranslations({
          reference: 'product',
          reference_id: bosch.id,
          locale_code: 'sr-RS',
        }),
      ).toHaveLength(0);
      expect(await stockOf('BOSCH-S4-024')).toBeUndefined();

      await seed();

      const restored = await translation.listTranslations({
        reference: 'product',
        reference_id: bosch.id,
        locale_code: 'sr-RS',
      });
      expect(restored).toHaveLength(1);
      expect(restored[0].translations).toEqual(BOSCH.translations.sr);
      expect(await stockOf('BOSCH-S4-024')).toBe(BOSCH.stock);
      expect(await stockOf('EXIDE-AGM-EK950')).toBe(EXIDE.stock);
    });

    it('serves the Russian text by default and the seeded translations on request', async () => {
      const headers = await storeHeaders(getContainer);
      const search = `handle=${BOSCH.handle}&fields=title,description`;

      expect((await storeProduct(search, headers)).description).toBe(
        BOSCH.description,
      );
      expect(
        (await storeProduct(`${search}&locale=sr-RS`, headers)).description,
      ).toBe(BOSCH.translations.sr.description);
      expect(
        (await storeProduct(search, { ...headers, 'x-medusa-locale': 'en-US' }))
          .description,
      ).toBe(BOSCH.translations.en.description);
    });

    it('localises every field the storefront shows, but never the product type key (M-3)', async () => {
      const container = getContainer();
      const {
        data: [channel],
      } = await query().graph({
        entity: 'sales_channel',
        fields: ['id'],
        filters: { name: SHOP.salesChannelName },
      });
      const {
        data: [type],
      } = await query().graph({
        entity: 'product_type',
        fields: ['id'],
        filters: { value: 'batteries' },
      });

      const {
        result: [created],
      } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: 'Аккумулятор тест',
              subtitle: 'Для старта в мороз',
              description: 'Описание',
              handle: 'translation-smoke',
              status: ProductStatus.PUBLISHED,
              type_id: type.id,
              sales_channels: [{ id: channel.id }],
              options: [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION] }],
              variants: [
                {
                  title: 'Стандарт',
                  sku: 'TRANSLATION-SMOKE',
                  manage_inventory: false,
                  options: { [DEFAULT_OPTION]: DEFAULT_OPTION },
                  prices: [{ currency_code: SHOP.currency, amount: 1000 }],
                },
              ],
            },
          ],
        },
      });
      const {
        data: [variant],
      } = await query().graph({
        entity: 'product_variant',
        fields: ['id'],
        filters: { sku: 'TRANSLATION-SMOKE' },
      });

      await createTranslationsWorkflow(container).run({
        input: {
          translations: [
            {
              reference: 'product',
              reference_id: created.id,
              locale_code: 'sr-RS',
              translations: {
                title: 'Akumulator test',
                subtitle: 'Za start po mrazu',
                description: 'Opis',
              },
            },
            {
              reference: 'product_variant',
              reference_id: variant.id,
              locale_code: 'sr-RS',
              translations: { title: 'Standard' },
            },
          ],
        },
      });

      const served = await storeProduct(
        'handle=translation-smoke&fields=title,subtitle,description,*variants,*type&locale=sr-RS',
        await storeHeaders(getContainer),
      );

      expect(served).toMatchObject({
        title: 'Akumulator test',
        subtitle: 'Za start po mrazu',
        description: 'Opis',
        type: expect.objectContaining({ value: 'batteries' }),
      });
      expect(
        served.variants.map((row: { title: string }) => row.title),
      ).toEqual(['Standard']);
    });

    it('lets the owner correct a translation by hand through the admin API (M-2)', async () => {
      const headers = { headers: await adminHeaders(api, getContainer) };
      const {
        data: [bosch],
      } = await query().graph({
        entity: 'product',
        fields: ['id'],
        filters: { handle: BOSCH.handle },
      });
      const [serbian] = await getContainer()
        .resolve(Modules.TRANSLATION)
        .listTranslations({ reference_id: bosch.id, locale_code: 'sr-RS' });

      const { status } = await api.post(
        '/admin/translations/batch',
        {
          update: [
            {
              id: serbian.id,
              translations: {
                title: BOSCH.translations.sr.title,
                description: 'Ručno ispravljen opis',
              },
            },
          ],
        },
        headers,
      );
      expect(status).toBe(200);

      const served = await storeProduct(
        `handle=${BOSCH.handle}&fields=description&locale=sr-RS`,
        await storeHeaders(getContainer),
      );
      expect(served.description).toBe('Ručno ispravljen opis');
    });
  },
});
