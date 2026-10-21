import { z } from '@medusajs/framework/zod';
import {
  BODY_STYLES,
  ENGINE_FUELS,
  STEERING_SIDES,
  VEHICLE_DRIVES,
  VEHICLE_IDENTIFIER_TYPES,
} from '@podbor/catalog-contract';

const text = z.string().trim().min(1);
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const code = z.string().trim().toUpperCase().min(1);
const year = z.number().int().min(1950).max(2100).nullable();

export const AdminMake = z.object({ slug, name: text });

export const AdminSeries = z.object({
  make_id: text,
  name: text,
  translations: z
    .object({ sr: text.optional(), en: text.optional() })
    .nullable()
    .optional(),
});

export const AdminChassis = z.object({
  series_id: text,
  code,
  body_style: z.enum(BODY_STYLES),
  year_from: year.optional(),
  year_to: year.optional(),
});

export const AdminVehicleModel = z.object({
  chassis_id: text,
  slug,
  name: text,
});

export const AdminEngine = z.object({
  code,
  family: code,
  fuel: z.enum(ENGINE_FUELS),
  displacement_cc: z.number().int().positive().nullable().optional(),
});

export const AdminVehicle = z.object({
  model_id: text,
  engine_id: text,
  power_kw: z.number().int().positive().nullable().optional(),
  drive: z.enum(VEHICLE_DRIVES).nullable().optional(),
  market: text.nullable().optional(),
  year_from: year.optional(),
  year_to: year.optional(),
  steering: z.enum(STEERING_SIDES).nullable().optional(),
});

export const AdminVehicleIdentifier = z.object({
  vehicle_id: text,
  type: z.enum(VEHICLE_IDENTIFIER_TYPES),
  value: code,
});

export const VEHICLE_REFERENCE_BODIES = [
  ['/admin/makes', AdminMake],
  ['/admin/series', AdminSeries],
  ['/admin/chassis', AdminChassis],
  ['/admin/vehicle-models', AdminVehicleModel],
  ['/admin/engines', AdminEngine],
  ['/admin/vehicles', AdminVehicle],
  ['/admin/vehicle-identifiers', AdminVehicleIdentifier],
] as const;
