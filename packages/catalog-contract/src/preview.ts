import { z } from 'zod';

export const SHOP_PREVIEW_HEADER = 'x-shop-preview';

export const shopOpenSchema = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => (value ? value === 'true' : undefined));
