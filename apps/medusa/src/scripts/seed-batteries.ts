import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ExecArgs,
  Logger,
  MedusaContainer,
  RemoteQueryFunction,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from '@medusajs/framework/utils';
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createTranslationsWorkflow,
  uploadFilesWorkflow,
} from '@medusajs/medusa/core-flows';
import { MEDUSA_LOCALE } from '@podbor/shop-catalog';

import { productSource, translationStamps } from '../lib/product-source';
import { DEFAULT_OPTION, SHOP } from '../lib/shop';
import { TARGET_LOCALES } from '../lib/translate-config';
import { BATTERIES, type Battery } from './battery-fixture';
import { seedBase } from './seed-base';

const BATTERY_TYPE = 'batteries';

type Query = Omit<RemoteQueryFunction, symbol>;

const skuOf = (battery: Battery): string => battery.handle.toUpperCase();

const imageOf = (battery: Battery): string =>
  readFileSync(
    join(__dirname, 'fixtures', 'batteries', `${battery.handle}.png`),
  ).toString('base64');

async function repairExisting(
  container: MedusaContainer,
  query: Query,
  logger: Logger,
  batteries: Battery[],
  locationId: string,
): Promise<void> {
  if (!batteries.length) {
    return;
  }
  const { data: products } = await query.graph({
    entity: 'product',
    fields: [
      'id',
      'handle',
      'variants.sku',
      'variants.inventory_items.inventory_item_id',
    ],
    filters: { handle: batteries.map((battery) => battery.handle) },
  });
  const byHandle = new Map(
    batteries.map((battery) => [battery.handle, battery]),
  );
  const translation = container.resolve(Modules.TRANSLATION);

  const missingTranslations: {
    reference: 'product';
    reference_id: string;
    locale_code: string;
    translations: Record<string, string>;
  }[] = [];
  const missingLevels: {
    inventory_item_id: string;
    location_id: string;
    stocked_quantity: number;
  }[] = [];

  for (const product of products) {
    const battery = byHandle.get(product.handle);
    if (!battery) {
      continue;
    }

    for (const locale of TARGET_LOCALES) {
      const locale_code = MEDUSA_LOCALE[locale];
      const existing = await translation.listTranslations({
        reference: 'product',
        reference_id: product.id,
        locale_code,
      });
      if (!existing.length) {
        missingTranslations.push({
          reference: 'product',
          reference_id: product.id,
          locale_code,
          translations: battery.translations[locale],
        });
      }
    }

    const itemId = (product.variants ?? []).find(
      (variant) => variant?.sku === skuOf(battery),
    )?.inventory_items?.[0]?.inventory_item_id;
    if (itemId) {
      const { data: levels } = await query.graph({
        entity: 'inventory_level',
        fields: ['id'],
        filters: { inventory_item_id: itemId, location_id: locationId },
      });
      if (!levels.length) {
        missingLevels.push({
          inventory_item_id: itemId,
          location_id: locationId,
          stocked_quantity: battery.stock,
        });
      }
    }
  }

  if (missingTranslations.length) {
    await createTranslationsWorkflow(container).run({
      input: { translations: missingTranslations },
    });
    logger.info(`Battery translations restored: ${missingTranslations.length}`);
  }
  if (missingLevels.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: missingLevels },
    });
    logger.info(`Battery inventory levels restored: ${missingLevels.length}`);
  }
}

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

  await repairExisting(
    container,
    query,
    logger,
    BATTERIES.filter((battery) => present.has(battery.handle)),
    locationId,
  );

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
          ...translationStamps(productSource(battery)),
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
        TARGET_LOCALES.map((locale) => ({
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
