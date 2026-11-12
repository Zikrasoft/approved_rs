import { z } from 'zod';
import { displayEnum } from './displayEnum.ts';
import { requirementSchema } from './attributes.ts';
import { pageFields } from './page.ts';
import { STEERING_SIDES } from './steering.ts';
import { translationsSchema } from './translations.ts';
import { vinOf } from '@podbor/lead-crm/vin';

export { STEERING_SIDES, type SteeringSide } from './steering.ts';

export const MANUFACTURER_VEHICLE_IDENTIFIER_TYPES = [
  'bmw-type-code',
  'mercedes-baumuster',
  'vag-model-code',
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

const flatSeriesTranslationsSchema = z
  .object({ sr: z.string().optional(), en: z.string().optional() })
  .transform(({ sr, en }) => ({
    ...(sr !== undefined && { sr: { name: sr } }),
    ...(en !== undefined && { en: { name: en } }),
  }));

const seriesTranslationsSchema = z
  .union([translationsSchema, flatSeriesTranslationsSchema])
  .catch(null);

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
        translations: seriesTranslationsSchema,
        make: z.object({ slug: z.string(), name: z.string() }),
      }),
    }),
  }),
  engine: z
    .object({
      code: z.string(),
      family: z.string(),
      fuel: displayEnum(ENGINE_FUELS),
      displacement_cc: z.number().nullable(),
    })
    .nullable(),
  identifiers: z.array(vehicleIdentifierSchema),
  requirements: z.array(requirementSchema),
});

export type Vehicle = z.infer<typeof vehicleSchema>;

export const vehiclesResponseSchema = z.object({
  vehicles: z.array(vehicleSchema),
  ...pageFields,
});

export const VIN_REFUSAL =
  'Not a VIN: 17 Latin letters and digits, without I, O or Q';

export const vinSchema = z.string().transform((text, context) => {
  const vin = vinOf(text);
  if (vin) return vin;
  context.addIssue({ code: 'custom', message: VIN_REFUSAL });
  return z.NEVER;
});

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
    .extend({ engine: z.object({ code: z.string() }).nullable() })
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

export type NamedModel = {
  name: string;
  chassis?: {
    code: string;
    series?: { name: string; make?: { name: string } };
  };
};

const joined = (words: (string | undefined)[]): string =>
  words
    .filter((word) => word)
    .filter((word, index, all) => !all[index + 1]?.startsWith(`${word} `))
    .join(' ');

export function vehicleName(
  { name, chassis }: NamedModel,
  seriesName = chassis?.series?.name,
): { make: string; model: string; full: string } {
  const code = chassis?.code;
  const make = chassis?.series?.make?.name;
  const repeated =
    !code || code === chassis?.series?.name || name.includes(code);
  const model = joined([seriesName, repeated ? '' : code, name]);
  return { make: make ?? '', model, full: joined([make, model]) };
}

export const vehicleLabel = ({
  model,
  engine,
}: {
  model: NamedModel;
  engine: { code: string } | null;
}): string =>
  engine
    ? `${vehicleName(model).full}, ${engine.code}`
    : vehicleName(model).full;

type GenerationMember = {
  engine: object | null;
  power_kw: number | null;
  year_from: number | null;
  year_to: number | null;
  model: { slug: string; chassis: { series: { make: { slug: string } } } };
};

const sameModel = (a: GenerationMember, b: GenerationMember) =>
  a.model.slug === b.model.slug &&
  a.model.chassis.series.make.slug === b.model.chassis.series.make.slug;

const yearsOverlap = (a: GenerationMember, b: GenerationMember) =>
  (a.year_from ?? -Infinity) <= (b.year_to ?? Infinity) &&
  (b.year_from ?? -Infinity) <= (a.year_to ?? Infinity);

const powerAgrees = (a: GenerationMember, b: GenerationMember) =>
  a.power_kw === null || b.power_kw === null || a.power_kw === b.power_kw;

export const generationOf = <Member extends GenerationMember>(
  vehicle: GenerationMember,
  vehicles: Member[],
): Member[] =>
  vehicle.engine === null
    ? []
    : vehicles.filter(
        (other) =>
          other.engine === null &&
          sameModel(vehicle, other) &&
          yearsOverlap(vehicle, other) &&
          powerAgrees(vehicle, other),
      );
