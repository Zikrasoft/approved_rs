import { z } from 'zod';

export const SHOP_STATUSES = ['off', 'preview', 'live'] as const;

export type ShopStatus = (typeof SHOP_STATUSES)[number];

export const DEFAULT_SHOP_STATUS: ShopStatus = 'off';

const statusSchema = z.enum(SHOP_STATUSES).default(DEFAULT_SHOP_STATUS);

export function readShopStatus(
  env: Record<string, string | undefined>,
): ShopStatus {
  return statusSchema.parse(env.SHOP_STATUS);
}

export const SHOP_STATUS = readShopStatus(process.env);

export const shopBuilt = (status: ShopStatus = SHOP_STATUS): boolean =>
  status !== 'off';

export const shopIndexed = (status: ShopStatus = SHOP_STATUS): boolean =>
  status === 'live';

export const devOnly = (
  status: ShopStatus = SHOP_STATUS,
): Record<string, string> =>
  status === 'preview' ? { 'data-dev-only': '' } : {};
