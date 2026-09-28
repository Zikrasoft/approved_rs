import type {
  ExecArgs,
  Logger,
  MedusaContainer,
  RemoteQueryFunction,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from '@medusajs/framework/utils';
import {
  createApiKeysWorkflow,
  createLocationFulfillmentSetWorkflow,
  createProductTypesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from '@medusajs/medusa/core-flows';
import { WORKSHOP_ADDRESS } from '@podbor/brands';
import { PRODUCT_TYPES, SERVICE_TYPE } from '@podbor/shop-catalog';

import {
  DEFAULT_OPTION,
  INSTALLATION_SEED_PRICE,
  INSTALLATION_TITLES,
  SERBIAN_LOCALE,
  SHOP,
  STORE_LOCALES,
} from '../lib/shop';

type Query = Omit<RemoteQueryFunction, symbol>;

export type BaseIds = {
  salesChannelId: string;
  regionId: string;
  locationId: string;
  shippingProfileId: string;
  typeIds: Map<string, string>;
};

export async function seedBase(
  container: MedusaContainer,
  logger: Logger,
): Promise<BaseIds> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const salesChannelId = await ensureSalesChannel(container, query, logger);
  const regionId = await ensureRegion(container, query, logger);
  await ensureTaxRegion(container, query, logger);
  const shippingProfileId = await ensureShippingProfile(
    container,
    query,
    logger,
  );
  const locationId = await ensureLocation(
    container,
    query,
    salesChannelId,
    logger,
  );
  await ensurePickup(container, query, locationId, shippingProfileId, logger);
  await ensurePublishableKey(container, query, salesChannelId, logger);
  await ensureSerbianLocale(container, logger);
  await ensureStore(
    container,
    query,
    { salesChannelId, regionId, locationId },
    logger,
  );
  const typeIds = await ensureProductTypes(container, query, logger);
  const serviceTypeId = typeIds.get(SERVICE_TYPE);
  if (!serviceTypeId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Product type "${SERVICE_TYPE}" is missing right after being created`,
    );
  }
  await ensureInstallationServices(
    container,
    query,
    { salesChannelId, shippingProfileId, serviceTypeId },
    logger,
  );

  return { salesChannelId, regionId, locationId, shippingProfileId, typeIds };
}

async function ensureSalesChannel(
  container: MedusaContainer,
  query: Query,
  logger: Logger,
): Promise<string> {
  const { data } = await query.graph({
    entity: 'sales_channel',
    fields: ['id'],
    filters: { name: SHOP.salesChannelName },
  });
  if (data[0]) {
    return data[0].id;
  }
  const { result } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: SHOP.salesChannelName }] },
  });
  logger.info(`Sales channel created: ${SHOP.salesChannelName}`);
  return result[0].id;
}

async function ensureRegion(
  container: MedusaContainer,
  query: Query,
  logger: Logger,
): Promise<string> {
  const { data } = await query.graph({
    entity: 'region',
    fields: ['id'],
    filters: { currency_code: SHOP.currency },
  });
  if (data[0]) {
    return data[0].id;
  }
  const { result } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: SHOP.regionName,
          currency_code: SHOP.currency,
          countries: [SHOP.country],
          payment_providers: [SHOP.paymentProvider],
        },
      ],
    },
  });
  logger.info(`Region created: ${SHOP.regionName}`);
  return result[0].id;
}

async function ensureTaxRegion(
  container: MedusaContainer,
  query: Query,
  logger: Logger,
): Promise<void> {
  const { data } = await query.graph({
    entity: 'tax_region',
    fields: ['id'],
    filters: { country_code: SHOP.country },
  });
  if (data.length) {
    return;
  }
  await createTaxRegionsWorkflow(container).run({
    input: [{ country_code: SHOP.country, provider_id: SHOP.taxProvider }],
  });
  logger.info('Tax region created with no rates: CarLab is not a PDV payer');
}

async function ensureShippingProfile(
  container: MedusaContainer,
  query: Query,
  logger: Logger,
): Promise<string> {
  const { data } = await query.graph({
    entity: 'shipping_profile',
    fields: ['id', 'type'],
  });
  const existing = data.find((profile) => profile.type === 'default');
  if (existing) {
    return existing.id;
  }
  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name: 'Стандартный', type: 'default' }] },
  });
  logger.info('Shipping profile created');
  return result[0].id;
}

async function ensureLocation(
  container: MedusaContainer,
  query: Query,
  salesChannelId: string,
  logger: Logger,
): Promise<string> {
  const { data } = await query.graph({
    entity: 'stock_location',
    fields: ['id', 'sales_channels.id', 'fulfillment_providers.id'],
    filters: { name: SHOP.locationName },
  });
  const found = data[0];
  let locationId: string | undefined = found?.id;

  if (!locationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: SHOP.locationName,
            address: {
              address_1: WORKSHOP_ADDRESS.street,
              city: WORKSHOP_ADDRESS.city,
              country_code: WORKSHOP_ADDRESS.country.toLowerCase(),
            },
          },
        ],
      },
    });
    locationId = result[0].id;
    logger.info(`Stock location created: ${SHOP.locationName}`);
  }

  const channels = found?.sales_channels ?? [];
  if (!channels.some((channel) => channel?.id === salesChannelId)) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: locationId, add: [salesChannelId] },
    });
    logger.info('Stock location linked to the sales channel');
  }

  const providers = found?.fulfillment_providers ?? [];
  if (
    !providers.some((provider) => provider?.id === SHOP.fulfillmentProvider)
  ) {
    await container.resolve(ContainerRegistrationKeys.LINK).create({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: SHOP.fulfillmentProvider,
      },
    });
    logger.info(`Fulfillment provider linked: ${SHOP.fulfillmentProvider}`);
  }

  return locationId;
}

async function ensurePickup(
  container: MedusaContainer,
  query: Query,
  locationId: string,
  shippingProfileId: string,
  logger: Logger,
): Promise<void> {
  const pickupSetId = async (): Promise<string | undefined> => {
    const { data } = await query.graph({
      entity: 'stock_location',
      fields: ['fulfillment_sets.id', 'fulfillment_sets.type'],
      filters: { id: locationId },
    });
    return data[0]?.fulfillment_sets?.find(
      (set) => set?.type === SHOP.fulfillmentSetType,
    )?.id;
  };

  let setId = await pickupSetId();
  if (!setId) {
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: locationId,
        fulfillment_set_data: {
          name: SHOP.fulfillmentSetName,
          type: SHOP.fulfillmentSetType,
        },
      },
    });
    setId = await pickupSetId();
    logger.info('Pickup fulfillment set created');
  }
  if (!setId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      'The pickup fulfillment set is missing right after being created',
    );
  }

  const { data: zones } = await query.graph({
    entity: 'service_zone',
    fields: ['id', 'fulfillment_set_id'],
  });
  let zoneId: string | undefined = zones.find(
    (zone) => zone.fulfillment_set_id === setId,
  )?.id;
  if (!zoneId) {
    const { result } = await createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            name: SHOP.serviceZoneName,
            fulfillment_set_id: setId,
            geo_zones: [{ type: 'country', country_code: SHOP.country }],
          },
        ],
      },
    });
    zoneId = result[0].id;
    logger.info('Pickup service zone created');
  }

  const { data: options } = await query.graph({
    entity: 'shipping_option',
    fields: ['id', 'type.code'],
  });
  if (options.some((option) => option.type?.code === SHOP.pickupCode)) {
    return;
  }
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: SHOP.pickupName,
        service_zone_id: zoneId,
        shipping_profile_id: shippingProfileId,
        provider_id: SHOP.fulfillmentProvider,
        price_type: 'flat',
        prices: [{ currency_code: SHOP.currency, amount: 0 }],
        type: {
          label: SHOP.pickupName,
          description: 'Забрать заказ в сервисе CarLab',
          code: SHOP.pickupCode,
        },
        rules: [
          { attribute: 'is_return', operator: 'eq', value: 'false' },
          { attribute: 'enabled_in_store', operator: 'eq', value: 'true' },
        ],
      },
    ],
  });
  logger.info('Pickup shipping option created');
}

async function ensurePublishableKey(
  container: MedusaContainer,
  query: Query,
  salesChannelId: string,
  logger: Logger,
): Promise<void> {
  const { data } = await query.graph({
    entity: 'api_key',
    fields: ['id', 'token', 'title', 'type', 'revoked_at'],
  });
  const existing = data.find(
    (key) =>
      key.type === 'publishable' &&
      key.title === SHOP.publishableKeyTitle &&
      !key.revoked_at,
  );
  if (existing) {
    logger.info(`Publishable key: ${existing.token}`);
    return;
  }
  const { result } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: SHOP.publishableKeyTitle,
          type: 'publishable',
          created_by: 'seed',
        },
      ],
    },
  });
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: result[0].id, add: [salesChannelId] },
  });
  logger.info(
    `Publishable key created: ${result[0].token} — the storefront reads it as PUBLIC_MEDUSA_PUBLISHABLE_KEY`,
  );
}

async function ensureSerbianLocale(
  container: MedusaContainer,
  logger: Logger,
): Promise<void> {
  const translation = container.resolve(Modules.TRANSLATION);
  const existing = await translation.listLocales({ code: SERBIAN_LOCALE.code });
  if (existing.length) {
    return;
  }
  await translation.createLocales(SERBIAN_LOCALE);
  logger.info(`Locale created: ${SERBIAN_LOCALE.code}`);
}

async function ensureStore(
  container: MedusaContainer,
  query: Query,
  ids: { salesChannelId: string; regionId: string; locationId: string },
  logger: Logger,
): Promise<void> {
  const { data } = await query.graph({
    entity: 'store',
    fields: [
      'id',
      'supported_currencies.currency_code',
      'supported_currencies.is_default',
      'supported_locales.locale_code',
      'default_region_id',
      'default_location_id',
      'default_sales_channel_id',
    ],
  });
  const store = data[0];
  if (!store) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'No store found. Medusa creates one on first boot.',
    );
  }

  const currencies = (store.supported_currencies ?? []).flatMap((currency) =>
    currency ? [currency] : [],
  );
  const existingLocales = new Set(
    (store.supported_locales ?? [])
      .map((locale) => locale?.locale_code)
      .filter((code): code is string => Boolean(code)),
  );
  const hasRsd = currencies.some(
    (currency) => currency.currency_code === SHOP.currency,
  );
  const settled =
    hasRsd &&
    STORE_LOCALES.every((locale) => existingLocales.has(locale)) &&
    Boolean(store.default_region_id) &&
    Boolean(store.default_location_id) &&
    Boolean(store.default_sales_channel_id);
  if (settled) {
    return;
  }

  const hasDefaultCurrency = currencies.some(
    (currency) => currency.is_default === true,
  );
  const keptCurrencies = currencies.map((currency) => ({
    currency_code: currency.currency_code,
    is_default: currency.is_default,
  }));
  const supportedCurrencies = hasRsd
    ? keptCurrencies
    : [
        ...keptCurrencies,
        { currency_code: SHOP.currency, is_default: !hasDefaultCurrency },
      ];
  const supportedLocales = [
    ...new Set([...existingLocales, ...STORE_LOCALES]),
  ].map((locale_code) => ({ locale_code }));

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: supportedCurrencies,
        supported_locales: supportedLocales,
        ...(store.default_region_id ? {} : { default_region_id: ids.regionId }),
        ...(store.default_location_id
          ? {}
          : { default_location_id: ids.locationId }),
        ...(store.default_sales_channel_id
          ? {}
          : { default_sales_channel_id: ids.salesChannelId }),
      },
    },
  });
  logger.info('Store set to RSD, sr/en/ru and the CarLab defaults');
}

async function ensureProductTypes(
  container: MedusaContainer,
  query: Query,
  logger: Logger,
): Promise<Map<string, string>> {
  const wanted = [...PRODUCT_TYPES.map((type) => type.key), SERVICE_TYPE];
  const { data } = await query.graph({
    entity: 'product_type',
    fields: ['id', 'value'],
  });
  const ids = new Map<string, string>(
    data.map((type) => [type.value, type.id]),
  );
  const missing = wanted.filter((value) => !ids.has(value));
  if (missing.length) {
    const { result } = await createProductTypesWorkflow(container).run({
      input: { product_types: missing.map((value) => ({ value })) },
    });
    result.forEach((type) => ids.set(type.value, type.id));
    logger.info(`Product types created: ${missing.join(', ')}`);
  }
  return ids;
}

async function ensureInstallationServices(
  container: MedusaContainer,
  query: Query,
  ids: {
    salesChannelId: string;
    shippingProfileId: string;
    serviceTypeId: string;
  },
  logger: Logger,
): Promise<void> {
  const handles = Object.keys(INSTALLATION_TITLES);
  const { data } = await query.graph({
    entity: 'product',
    fields: ['handle'],
    filters: { handle: handles },
  });
  const present = new Set(data.map((product) => product.handle));
  const missing = handles.filter((handle) => !present.has(handle));
  if (!missing.length) {
    return;
  }
  await createProductsWorkflow(container).run({
    input: {
      products: missing.map((handle) => ({
        title: INSTALLATION_TITLES[handle],
        handle,
        status: ProductStatus.PUBLISHED,
        type_id: ids.serviceTypeId,
        shipping_profile_id: ids.shippingProfileId,
        sales_channels: [{ id: ids.salesChannelId }],
        options: [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION] }],
        variants: [
          {
            title: DEFAULT_OPTION,
            sku: handle.toUpperCase(),
            manage_inventory: false,
            options: { [DEFAULT_OPTION]: DEFAULT_OPTION },
            prices: [
              { currency_code: SHOP.currency, amount: INSTALLATION_SEED_PRICE },
            ],
          },
        ],
      })),
    },
  });
  logger.info(`Installation services created: ${missing.join(', ')}`);
  logger.warn(
    `Installation is priced at the seed's ${INSTALLATION_SEED_PRICE} RSD — set the real prices in the admin; a re-run never touches them`,
  );
}

export default async function seedBaseScript({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  await seedBase(container, logger);
  logger.info('Base seed finished');
}
