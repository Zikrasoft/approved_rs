import { z } from 'zod';
import { displayEnum } from './displayEnum.ts';
import { requirementSchema } from './attributes.ts';
import { STEERING_SIDES } from './steering.ts';
import { vinOf } from './vin.ts';

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
  count: z.number().int().nonnegative().nullable().default(null),
  offset: z.number().int().nonnegative().nullable().default(null),
  limit: z.number().int().positive().nullable().default(null),
});

export const vinSchema = z.string().transform(vinOf).pipe(z.string());

export const vinFactsSchema = z.object({
  steering: z.enum(STEERING_SIDES).optional().catch(undefined),
});

export type VinFacts = z.infer<typeof vinFactsSchema>;

export const CAR_KINDS = ['make', 'model', 'vehicle'] as const;

export type CarKind = (typeof CAR_KINDS)[number];

export const carHitSchema = z.object({
  kind: z.enum(CAR_KINDS),
  make: vehicleSchema.shape.model.shape.chassis.shape.series.shape.make,
  model: vehicleSchema.shape.model.nullable(),
  vehicle: vehicleSchema
    .pick({
      id: true,
      slug: true,
      power_kw: true,
      year_from: true,
      year_to: true,
    })
    .extend({ engine: vehicleSchema.shape.engine.pick({ code: true }) })
    .nullable(),
});

export type CarHit = z.infer<typeof carHitSchema>;

const placeSchema = carHitSchema.nullable().default(null).catch(null);

export const vinLookupResponseSchema = z.discriminatedUnion('resolved', [
  z.object({
    resolved: z.literal(true),
    vehicle: vehicleSchema,
    facts: vinFactsSchema,
    place: placeSchema,
  }),
  z.object({
    resolved: z.literal(false),
    make: z.string().nullable(),
    code: z.string().nullable(),
    model_slug: z.string().nullable().default(null),
    vehicle_ids: z.array(z.string()).default([]),
    place: placeSchema,
  }),
]);

export type VinLookupResponse = z.infer<typeof vinLookupResponseSchema>;
