import type {
  IRegionModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import {
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStoresWorkflow,
  updateStoresWorkflow,
} from '@medusajs/medusa/core-flows';

import { SHOP_CURRENCY } from '../modules/supplier/pricing';
import { CASH_AT_PICKUP_PROVIDER_ID } from './offer-cart';

const SALES_CHANNEL_NAME = 'CarLab parts shop';
const REGION_NAME = 'Serbia';
const STORE_NAME = 'CarLab';
const MEDUSA_DEFAULT_STORE_NAME = 'Medusa Store';
const REGION_CURRENCY = SHOP_CURRENCY.toLowerCase();

export async function seedCashAtPickupCommerceDefaults(
  container: MedusaContainer,
): Promise<void> {
  const storeModuleService: IStoreModuleService = container.resolve(
    Modules.STORE,
  );
  const salesChannelModuleService: ISalesChannelModuleService =
    container.resolve(Modules.SALES_CHANNEL);
  const regionModuleService: IRegionModuleService = container.resolve(
    Modules.REGION,
  );

  const [existingChannel] = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  });
  const salesChannel =
    existingChannel ??
    (
      await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
      })
    ).result[0];

  const [existingStore] = await storeModuleService.listStores();
  if (!existingStore) {
    await createStoresWorkflow(container).run({
      input: {
        stores: [
          {
            name: STORE_NAME,
            default_sales_channel_id: salesChannel.id,
            supported_currencies: [
              { currency_code: REGION_CURRENCY, is_default: true },
            ],
          },
        ],
      },
    });
  } else if (
    existingStore.default_sales_channel_id !== salesChannel.id ||
    existingStore.name === MEDUSA_DEFAULT_STORE_NAME
  ) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: existingStore.id },
        update: {
          default_sales_channel_id: salesChannel.id,
          ...(existingStore.name === MEDUSA_DEFAULT_STORE_NAME && {
            name: STORE_NAME,
          }),
        },
      },
    });
  }

  const [existingRegion] = await regionModuleService.listRegions({
    name: REGION_NAME,
  });
  if (!existingRegion) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: REGION_CURRENCY,
            countries: ['rs'],
            payment_providers: [CASH_AT_PICKUP_PROVIDER_ID],
          },
        ],
      },
    });
  }
}
