import { parseAttributes } from '@podbor/shop-catalog';
import { z } from 'zod';

import fixture from './fixtures/batteries.json';

const translatedSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
  })
  .strict();

const batterySchema = z
  .object({
    handle: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    price: z.number().int().positive(),
    stock: z.number().int().nonnegative(),
    spec: z.record(z.string(), z.unknown()),
    fitment: z.array(z.unknown()),
    translations: z
      .object({ sr: translatedSchema, en: translatedSchema })
      .strict(),
  })
  .strict()
  .superRefine((battery, ctx) => {
    const attributes = parseAttributes('batteries', {
      spec: battery.spec,
      fitment: battery.fitment,
    });
    if (!attributes.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['spec'],
        message: attributes.error,
      });
    }
  });

export type Battery = z.infer<typeof batterySchema>;

export const BATTERIES: readonly Battery[] = z
  .array(batterySchema)
  .parse(fixture);
