import {
  STEERING_SIDES,
  VEHICLE_DRIVES,
  type Vehicle,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import type CatalogModuleService from '../../modules/catalog/service';
import { listVehicleResponses } from '../store-response';
import rows from './bimmerarchive-type-keys.json';

const DRIVES: Record<string, (typeof VEHICLE_DRIVES)[number]> = {
  'Rear-Wheel Drive': 'rwd',
  'Front-Wheel Drive': 'fwd',
  'All Wheel-Drive': 'awd',
};

const BODIES_NAMED: [RegExp, string][] = [
  [/\btouring\b/i, 'Touring'],
  [/\bgran tourismo\b/i, 'Gran Turismo'],
  [/\bcabrio(?:let)?\b/i, 'Convertible'],
  [/\bcoupe\b/i, 'Coupe'],
];

const typeKeySchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{4}$/),
    chassis: z.string().transform((chassis) => chassis.split(' ')[0]),
    model: z.string(),
    body: z.string().nullable(),
    engine: z.string().nullable(),
    power_kw: z.number().int().positive().nullable(),
    drivetrain: z
      .string()
      .nullable()
      .transform((drivetrain) => (drivetrain && DRIVES[drivetrain]) ?? null),
    steering: z.enum(STEERING_SIDES),
    from: z.string().nullable(),
    to: z.string().nullable(),
  })
  .strict();

export type TypeKey = z.infer<typeof typeKeySchema>;

const TYPE_KEYS = new Map(
  z
    .array(typeKeySchema)
    .parse(rows)
    .map((key) => [key.code, key]),
);

export const typeKey = (code: string): TypeKey | undefined =>
  TYPE_KEYS.get(code);

const compact = (value: string) => value.replace(/\s+/g, '').toUpperCase();

const chassisCodes = (code: string) =>
  code
    .toUpperCase()
    .split(/[\s/,]+/)
    .filter(Boolean);

const engineFamily = (engine: string) =>
  /^[A-Z]+\d{2}/.exec(compact(engine))?.[0] ?? null;

const engineLitres = (engine: string | null) => {
  const tenths = engine && /^[A-Z]+\d{2}[A-Z](\d{2})/.exec(compact(engine));
  return tenths ? Number(tenths[1]) : null;
};

const designation = (name: string) => {
  const match = /(?<![\d.])(\d{3})\s?(tds|td|sd|is|ix|dx|si|d|i|e)?\b/i.exec(
    name,
  );
  return match ? (match[1] + (match[2] ?? '')).toLowerCase() : null;
};

const bodyNamed = (name: string) =>
  BODIES_NAMED.find(([pattern]) => pattern.test(name))?.[1] ?? null;

const yearOf = (month: string | null) =>
  month ? Number(month.slice(0, 4)) : null;

const agree = <T>(left: T | null, right: T | null) =>
  left === null || right === null || left === right;

const sameDisplacement = (key: TypeKey, cc: number | null) => {
  const litres = engineLitres(key.engine);
  return litres === null || cc === null || Math.abs(cc / 100 - litres) <= 1;
};

const yearsOverlap = (key: TypeKey, vehicle: Vehicle) => {
  const from = yearOf(key.from);
  const to = yearOf(key.to);
  return (
    !(from && vehicle.year_to && from > vehicle.year_to) &&
    !(to && vehicle.year_from && to < vehicle.year_from)
  );
};

const vehicleDrive = ({ drive, model }: Vehicle) =>
  drive ?? (/xdrive/i.test(model.name) ? 'awd' : null);

export const typeKeyDescribes = (key: TypeKey, vehicle: Vehicle): boolean => {
  const family = key.engine && engineFamily(key.engine);
  return (
    Boolean(family) &&
    key.power_kw !== null &&
    chassisCodes(vehicle.model.chassis.code).includes(key.chassis) &&
    compact(vehicle.engine.family) === family &&
    vehicle.power_kw === key.power_kw &&
    sameDisplacement(key, vehicle.engine.displacement_cc) &&
    agree(designation(key.model), designation(vehicle.model.name)) &&
    agree(bodyNamed(vehicle.model.name), key.body) &&
    agree(vehicleDrive(vehicle), key.drivetrain) &&
    agree(vehicle.steering, key.steering) &&
    yearsOverlap(key, vehicle)
  );
};

export const vehiclesDescribedByTypeKey = async (
  catalog: CatalogModuleService,
  make: string,
  code: string,
): Promise<Vehicle[]> => {
  const key = typeKey(code);
  if (!key) return [];
  const chassisIds = (
    await catalog.listChassis(
      { code: { $ilike: `%${key.chassis}%` } },
      { relations: ['series.make'], take: null },
    )
  )
    .filter(
      (chassis) =>
        chassis.series.make.slug === make &&
        chassisCodes(chassis.code).includes(key.chassis),
    )
    .map(({ id }) => id);
  if (!chassisIds.length) return [];
  const modelIds = (
    await catalog.listVehicleModels(
      { chassis_id: chassisIds },
      { select: ['id'], take: null },
    )
  ).map(({ id }) => id);
  if (!modelIds.length) return [];
  return (await listVehicleResponses(catalog, { model_id: modelIds })).filter(
    (vehicle) => typeKeyDescribes(key, vehicle),
  );
};
