import { z } from 'zod';
import { requirementSchema } from './attributes.ts';
import { STEERING_SIDES } from './steering.ts';

export { STEERING_SIDES, type SteeringSide } from './steering.ts';

export const VEHICLE_IDENTIFIER_TYPES = [
  'bmw-type-code',
  'mercedes-baumuster',
] as const;
export const VEHICLE_DRIVES = ['rwd', 'fwd', 'awd'] as const;
export const ENGINE_FUELS = ['petrol', 'diesel', 'hybrid', 'electric'] as const;
export const BODY_STYLES = [
  'sedan',
  'touring',
  'hatchback',
  'coupe',
  'convertible',
  'gran-coupe',
  'suv',
  'van',
] as const;

export type VehicleIdentifierType = (typeof VEHICLE_IDENTIFIER_TYPES)[number];

const translationsSchema = z
  .object({ sr: z.string().optional(), en: z.string().optional() })
  .nullable();

export const vehicleIdentifierSchema = z.object({
  type: z.enum(VEHICLE_IDENTIFIER_TYPES),
  value: z.string(),
});

export const vehicleSchema = z.object({
  id: z.string(),
  power_kw: z.number().nullable(),
  drive: z.enum(VEHICLE_DRIVES).nullable(),
  market: z.string().nullable(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
  steering: z.enum(STEERING_SIDES).nullable(),
  model: z.object({
    slug: z.string(),
    name: z.string(),
    chassis: z.object({
      code: z.string(),
      body_style: z.enum(BODY_STYLES),
      series: z.object({
        name: z.string(),
        translations: translationsSchema,
        make: z.object({ slug: z.string(), name: z.string() }),
      }),
    }),
  }),
  engine: z.object({
    code: z.string(),
    family: z.string(),
    fuel: z.enum(ENGINE_FUELS),
    displacement_cc: z.number().nullable(),
  }),
  identifiers: z.array(vehicleIdentifierSchema),
  requirements: z.array(requirementSchema),
});

export type Vehicle = z.infer<typeof vehicleSchema>;

export const vehiclesResponseSchema = z.object({
  vehicles: z.array(vehicleSchema),
});

export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export const vinSchema = z.string().trim().toUpperCase().regex(VIN_PATTERN);

export const vinFactsSchema = z.object({
  steering: z.enum(STEERING_SIDES).optional(),
});

export type VinFacts = z.infer<typeof vinFactsSchema>;

export const vinLookupResponseSchema = z.discriminatedUnion('resolved', [
  z.object({
    resolved: z.literal(true),
    vehicle: vehicleSchema,
    facts: vinFactsSchema,
  }),
  z.object({
    resolved: z.literal(false),
    make: z.string().nullable(),
    code: z.string().nullable(),
  }),
]);

export type VinLookupResponse = z.infer<typeof vinLookupResponseSchema>;
