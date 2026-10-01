import { CARLAB } from '@podbor/brands';
import {
  MEDUSA_LOCALE,
  PAYMENT_PROVIDER,
  PICKUP_OPTION_CODE,
  SHOP_COUNTRY,
  SHOP_CURRENCY,
} from '@podbor/shop-catalog';

export const SHOP = {
  currency: SHOP_CURRENCY,
  country: SHOP_COUNTRY,
  regionName: 'Srbija',
  salesChannelName: CARLAB.domain,
  publishableKeyTitle: CARLAB.domain,
  locationName: CARLAB.name,
  fulfillmentSetName: 'pickup',
  fulfillmentSetType: 'pickup',
  serviceZoneName: 'Srbija',
  pickupCode: PICKUP_OPTION_CODE,
  pickupName: 'Самовывоз',
  paymentProvider: PAYMENT_PROVIDER,
  taxProvider: 'tp_system',
  fulfillmentProvider: 'manual_manual',
} as const;

export const DEFAULT_OPTION = 'Default';

export const SERBIAN_LOCALE = { code: MEDUSA_LOCALE.sr, name: 'Srpski' };

export const STORE_LOCALES = [
  MEDUSA_LOCALE.sr,
  MEDUSA_LOCALE.en,
  MEDUSA_LOCALE.ru,
];

export const RESERVE_DAYS = 3;

export const INSTALLATION_SEED_PRICE = 1500;

export const INSTALLATION_TITLES: Record<string, string> = {
  'battery-installation': 'Установка аккумулятора',
  'brake-installation': 'Установка тормозов',
};

export type ShopLocale = keyof typeof MEDUSA_LOCALE;

export const FALLBACK_LOCALE: ShopLocale = 'sr';

const SHOP_LOCALES = Object.keys(MEDUSA_LOCALE) as ShopLocale[];

export function shopLocale(
  medusaLocale: string | null | undefined,
): ShopLocale {
  return (
    SHOP_LOCALES.find((locale) => MEDUSA_LOCALE[locale] === medusaLocale) ??
    FALLBACK_LOCALE
  );
}
