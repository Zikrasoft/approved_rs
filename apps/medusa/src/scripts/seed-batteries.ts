import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExecArgs } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from '@medusajs/framework/utils';
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createTranslationsWorkflow,
  uploadFilesWorkflow,
} from '@medusajs/medusa/core-flows';
import { MEDUSA_LOCALE } from '@podbor/shop-catalog';

import {
  TRANSLATED_FROM,
  productSource,
  sourceHash,
} from '../lib/product-source';
import { DEFAULT_OPTION, SHOP } from '../lib/shop';
import { BATTERIES, type Battery } from './battery-fixture';
import { seedBase } from './seed-base';

const BATTERY_TYPE = 'batteries';
const TRANSLATED_LOCALES = ['sr', 'en'] as const;

const skuOf = (battery: Battery): string => battery.handle.toUpperCase();

const imageOf = (battery: Battery): string =>
  readFileSync(
    join(__dirname, 'fixtures', 'batteries', `${battery.handle}.png`),
  ).toString('base64');

export default async function seedBatteries({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { salesChannelId, locationId, shippingProfileId, typeIds } =
    await seedBase(container, logger);

  const { data: existing } = await query.graph({
    entity: 'product',
    fields: ['handle'],
    filters: { handle: BATTERIES.map((battery) => battery.handle) },
  });
  const present = new Set(existing.map((product) => product.handle));
  const missing = BATTERIES.filter((battery) => !present.has(battery.handle));
  if (!missing.length) {
    logger.info('Batteries already seeded');
    return;
  }

  const { result: files } = await uploadFilesWorkflow(container).run({
    input: {
      files: missing.map((battery) => ({
        filename: `products/${battery.handle}.png`,
        mimeType: 'image/png',
        content: imageOf(battery),
        access: 'public' as const,
      })),
    },
  });

  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: missing.map((battery, index) => ({
        title: battery.title,
        handle: battery.handle,
        description: battery.description,
        status: ProductStatus.PUBLISHED,
        type_id: typeIds.get(BATTERY_TYPE),
        shipping_profile_id: shippingProfileId,
        sales_channels: [{ id: salesChannelId }],
        thumbnail: files[index].url,
        images: [{ url: files[index].url }],
        metadata: {
          spec: battery.spec,
          fitment: battery.fitment,
          [TRANSLATED_FROM]: sourceHash(productSource(battery)),
        },
        options: [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION] }],
        variants: [
          {
            title: DEFAULT_OPTION,
            sku: skuOf(battery),
            manage_inventory: true,
            options: { [DEFAULT_OPTION]: DEFAULT_OPTION },
            prices: [{ currency_code: SHOP.currency, amount: battery.price }],
          },
        ],
      })),
    },
  });

  const idByHandle = new Map(
    products.map((product) => [product.handle, product.id]),
  );
  await createTranslationsWorkflow(container).run({
    input: {
      translations: missing.flatMap((battery) =>
        TRANSLATED_LOCALES.map((locale) => ({
          reference: 'product',
          reference_id: idByHandle.get(battery.handle) as string,
          locale_code: MEDUSA_LOCALE[locale],
          translations: battery.translations[locale],
        })),
      ),
    },
  });

  const { data: variants } = await query.graph({
    entity: 'product_variant',
    fields: ['sku', 'inventory_items.inventory_item_id'],
    filters: { sku: missing.map(skuOf) },
  });
  const stockBySku = new Map(
    missing.map((battery) => [skuOf(battery), battery.stock]),
  );
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: variants.flatMap((variant) =>
        (variant.inventory_items ?? []).flatMap((item) =>
          item
            ? [
                {
                  inventory_item_id: item.inventory_item_id,
                  location_id: locationId,
                  stocked_quantity: stockBySku.get(variant.sku ?? '') ?? 0,
                },
              ]
            : [],
        ),
      ),
    },
  });

  logger.info(`Batteries seeded: ${missing.length}`);
  logger.warn(
    'Battery stock is the seed placeholder (4, or 0 where the old shop said out of stock) — set real stock in the admin',
  );
}
