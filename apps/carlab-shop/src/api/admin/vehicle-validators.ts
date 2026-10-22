import { z } from '@medusajs/framework/zod';
import {
  BODY_STYLES,
  CATALOG_TRANSLATION_LOCALES,
  ENGINE_FUELS,
  STEERING_SIDES,
  VEHICLE_DRIVES,
  VEHICLE_IDENTIFIER_TYPES,
  type VehicleIdentifierType,
} from '@podbor/catalog-contract';

import { MAX_NAME_LENGTH } from './validators';

const text = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const slug = z
  .string()
  .trim()
  .max(MAX_NAME_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const code = z.string().trim().toUpperCase().min(1).max(MAX_NAME_LENGTH);
const year = z.number().int().min(1950).max(2100).nullable();

const IDENTIFIER_FORMATS: Record<VehicleIdentifierType, RegExp> = {
  'bmw-type-code': /^[A-Z0-9]{4}$/,
  'mercedes-baumuster': /^\d{6}$/,
};

type Years = { year_from?: number | null; year_to?: number | null };

const yearsInOrder = ({ year_from, year_to }: Years) =>
  year_from == null || year_to == null || year_from <= year_to;

const YEARS_OUT_OF_ORDER = {
  path: ['year_to'],
  message: 'Ends before it starts',
};

type Identifier = { type?: VehicleIdentifierType; value?: string };

const identifierFormat = ({ type, value }: Identifier) =>
  !type || value === undefined || IDENTIFIER_FORMATS[type].test(value);

const BAD_IDENTIFIER_FORMAT = {
  path: ['value'],
  message: 'Does not match the format of its type',
};

const AdminMake = z.strictObject({ slug, name: text });

const AdminSeries = z.strictObject({
  make_id: text,
  name: text,
  translations: z
    .strictObject(
      Object.fromEntries(
        CATALOG_TRANSLATION_LOCALES.map((locale) => [locale, text.optional()]),
      ),
    )
    .nullable()
    .optional(),
});

const AdminChassis = z.strictObject({
  series_id: text,
  code,
  body_style: z.enum(BODY_STYLES),
  year_from: year.optional(),
  year_to: year.optional(),
});

const AdminVehicleModel = z.strictObject({
  chassis_id: text,
  slug,
  name: text,
});

const AdminEngine = z.strictObject({
  code,
  family: code,
  fuel: z.enum(ENGINE_FUELS),
  displacement_cc: z.number().int().positive().nullable().optional(),
});

const AdminVehicle = z.strictObject({
  model_id: text,
  engine_id: text,
  power_kw: z.number().int().positive().nullable().optional(),
  drive: z.enum(VEHICLE_DRIVES).nullable().optional(),
  market: text.nullable().optional(),
  year_from: year.optional(),
  year_to: year.optional(),
  steering: z.enum(STEERING_SIDES).nullable().optional(),
});

const AdminVehicleIdentifier = z.strictObject({
  vehicle_id: text,
  type: z.enum(VEHICLE_IDENTIFIER_TYPES),
  value: code,
});

const withYears = <Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) =>
  [
    schema.refine(yearsInOrder, YEARS_OUT_OF_ORDER),
    schema.partial().refine(yearsInOrder, YEARS_OUT_OF_ORDER),
  ] as const;

const plain = <Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) =>
  [schema, schema.partial()] as const;

const storedYears = z
  .object({ year_from: year.optional(), year_to: year.optional() })
  .refine(yearsInOrder, YEARS_OUT_OF_ORDER);

export const STORED_ROW_RULES: Record<string, z.ZodType> = {
  chassis: storedYears,
  vehicle: storedYears,
  vehicle_identifier: z
    .object({ type: z.enum(VEHICLE_IDENTIFIER_TYPES), value: z.string() })
    .refine(identifierFormat, BAD_IDENTIFIER_FORMAT),
};

export const VEHICLE_REFERENCE_BODIES = [
  ['/admin/makes', ...plain(AdminMake)],
  ['/admin/series', ...plain(AdminSeries)],
  ['/admin/chassis', ...withYears(AdminChassis)],
  ['/admin/vehicle-models', ...plain(AdminVehicleModel)],
  ['/admin/engines', ...plain(AdminEngine)],
  ['/admin/vehicles', ...withYears(AdminVehicle)],
  [
    '/admin/vehicle-identifiers',
    AdminVehicleIdentifier.refine(identifierFormat, BAD_IDENTIFIER_FORMAT),
    AdminVehicleIdentifier.partial().refine(
      identifierFormat,
      BAD_IDENTIFIER_FORMAT,
    ),
  ],
] as const;
