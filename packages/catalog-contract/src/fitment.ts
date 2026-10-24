import { z } from 'zod';
import { translationsSchema } from './categories.ts';
import { STEERING_SIDES } from './vehicle.ts';

export const FITMENT_AXLES = ['front', 'rear'] as const;
export const FITMENT_SIDES = ['left', 'right'] as const;
export const GEARBOX_TYPES = ['manual', 'automatic'] as const;

export type FitmentAxle = (typeof FITMENT_AXLES)[number];
export type FitmentSide = (typeof FITMENT_SIDES)[number];

export const fitmentSchema = z.object({
  id: z.string(),
  part_id: z.string(),
  vehicle_id: z.string(),
  quantity: z.number().int().positive(),
  axle: z.enum(FITMENT_AXLES).nullable(),
  side: z.enum(FITMENT_SIDES).nullable(),
  production_from: z.string().nullable(),
  production_to: z.string().nullable(),
  gearbox: z.enum(GEARBOX_TYPES).nullable(),
  steering: z.enum(STEERING_SIDES).nullable(),
  note: z.string().nullable(),
  translations: translationsSchema,
});

export const fitmentsResponseSchema = z.object({
  fitments: z.array(fitmentSchema),
  count: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export type Fitment = z.infer<typeof fitmentSchema>;
