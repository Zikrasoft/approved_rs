import { z } from 'zod';
import { displayEnum } from './displayEnum.ts';
import { translationsSchema } from './categories.ts';
import { pageFields } from './page.ts';
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
  axle: displayEnum(FITMENT_AXLES),
  side: displayEnum(FITMENT_SIDES),
  production_from: z.string().nullable(),
  production_to: z.string().nullable(),
  gearbox: displayEnum(GEARBOX_TYPES),
  steering: displayEnum(STEERING_SIDES),
  note: z.string().nullable(),
  translations: translationsSchema,
});

export const fitmentsResponseSchema = z.object({
  fitments: z.array(fitmentSchema),
  ...pageFields,
});

export type Fitment = z.infer<typeof fitmentSchema>;

export const siteFitmentSchema = fitmentSchema.omit({ id: true }).extend({
  quantity: fitmentSchema.shape.quantity.default(1),
  production_from: fitmentSchema.shape.production_from.default(null),
  production_to: fitmentSchema.shape.production_to.default(null),
  note: fitmentSchema.shape.note.default(null),
  translations: translationsSchema.default(null),
});

export type SiteFitment = z.infer<typeof siteFitmentSchema>;
