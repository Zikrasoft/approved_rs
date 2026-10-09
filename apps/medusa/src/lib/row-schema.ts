import { BigNumber } from '@medusajs/framework/utils';
import { z } from 'zod';

export const nullableText = z.string().nullish();

export const metadataField = z.record(z.string(), z.unknown()).nullish();

export const typeValueField = z.object({ value: nullableText }).nullish();

export const idRowSchema = z.object({ id: z.string() });

export const moneyField = z
  .union([z.number(), z.string().trim().min(1), z.instanceof(BigNumber)])
  .transform(Number)
  .pipe(z.number());

export const quantityField = moneyField.pipe(z.number().int().nonnegative());
