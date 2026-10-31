import { z } from 'zod';

export const SHOP_PREVIEW_HEADER = 'x-shop-preview';

export const shopPreviewTokenSchema = z
  .string()
  .regex(
    /^[\w-]{32,256}$/,
    'a preview token is 32 to 256 letters, digits, _ or -',
  );

export const shopOpenSchema = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => (value ? value === 'true' : undefined));
