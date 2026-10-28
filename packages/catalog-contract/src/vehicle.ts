import { z } from 'zod';
import { displayEnum } from './displayEnum.ts';
import { requirementSchema } from './attributes.ts';
import { STEERING_SIDES } from './steering.ts';
import { VIN_PATTERN } from './vin.ts';

export { STEERING_SIDES, type SteeringSide } from './steering.ts';
export { VIN_PATTERN } from './vin.ts';

export const MANUFACTURER_VEHICLE_IDENTIFIER_TYPES = [
  'bmw-type-code',
  'mercedes-baumuster',
] as const;
export const SUPPLIER_VEHICLE_ID = 'supplier-vehicle-id';
export const VEHICLE_IDENTIFIER_TYPES = [
  ...MANUFACTURER_VEHICLE_IDENTIFIER_TYPES,
  SUPPLIER_VEHICLE_ID,
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
export type ManufacturerVehicleIdentifierType =
  (typeof MANUFACTURER_VEHICLE_IDENTIFIER_TYPES)[number];

const translationsSchema = z
  .object({ sr: z.string().optional(), en: z.string().optional() })
  .nullable();

export const vehicleIdentifierSchema = z.object({
  type: displayEnum(VEHICLE_IDENTIFIER_TYPES),
  value: z.string(),
});

export const vehicleSchema = z.object({
  id: z.string(),
  slug: z.string().nullable().default(null),
  power_kw: z.number().nullable(),
  drive: displayEnum(VEHICLE_DRIVES),
  market: z.string().nullable(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
  steering: displayEnum(STEERING_SIDES),
  model: z.object({
    slug: z.string(),
    name: z.string(),
    chassis: z.object({
      code: z.string(),
      body_style: displayEnum(BODY_STYLES),
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
    fuel: displayEnum(ENGINE_FUELS),
    displacement_cc: z.number().nullable(),
  }),
  identifiers: z.array(vehicleIdentifierSchema),
  requirements: z.array(requirementSchema),
});

export type Vehicle = z.infer<typeof vehicleSchema>;

export const vehiclesResponseSchema = z.object({
  vehicles: z.array(vehicleSchema),
});

export const vinSchema = z
  .string()
  .transform((value) => value.replace(/[\s.-]+/g, '').toUpperCase())
  .pipe(z.string().regex(VIN_PATTERN));

export const vinFactsSchema = z.object({
  steering: z.enum(STEERING_SIDES).optional().catch(undefined),
});

export type VinFacts = z.infer<typeof vinFactsSchema>;

export const placePagesSchema = z.object({
  vehicle: z.boolean(),
  model: z.boolean(),
  make: z.boolean(),
});

export type PlacePages = z.infer<typeof placePagesSchema>;

export const vinLookupResponseSchema = z.discriminatedUnion('resolved', [
  z.object({
    resolved: z.literal(true),
    vehicle: vehicleSchema,
    facts: vinFactsSchema,
    pages: placePagesSchema.nullable().default(null).catch(null),
  }),
  z.object({
    resolved: z.literal(false),
    make: z.string().nullable(),
    code: z.string().nullable(),
    model_slug: z.string().nullable().default(null),
    vehicle_ids: z.array(z.string()).default([]),
  }),
]);

export type VinLookupResponse = z.infer<typeof vinLookupResponseSchema>;
