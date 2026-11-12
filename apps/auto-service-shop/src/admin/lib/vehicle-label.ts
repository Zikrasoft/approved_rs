import type { useTranslation } from 'react-i18next';
import {
  STEERING_SIDES,
  VEHICLE_DRIVES,
  vehicleName,
} from '@podbor/catalog-contract';
import { z } from 'zod';

export type TFunction = ReturnType<typeof useTranslation>['t'];

export const labelledVehicleSchema = z.object({
  id: z.string(),
  power_kw: z.number().nullable().optional(),
  year_from: z.number().nullable().optional(),
  year_to: z.number().nullable().optional(),
  steering: z.string().nullable().optional(),
  model: z.object({
    name: z.string(),
    chassis: z
      .object({
        code: z.string(),
        series: z
          .object({
            name: z.string(),
            make: z.object({ name: z.string() }).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
  engine: z.object({ code: z.string() }).nullable(),
});

export type LabelledVehicle = z.infer<typeof labelledVehicleSchema>;

const yearSpan = (
  t: TFunction,
  from: number | string | null | undefined,
  to: number | string | null | undefined,
): string | null => {
  if (from && to) return t('vehicleLabel.between', { from, to });
  if (from) return t('vehicleLabel.since', { from });
  return to ? t('vehicleLabel.until', { to }) : null;
};

const years = (t: TFunction, { year_from, year_to }: LabelledVehicle) =>
  yearSpan(t, year_from, year_to);

export const vehicleSpecLabel = (t: TFunction, vehicle: LabelledVehicle) => {
  const { model, engine, power_kw, steering } = vehicle;
  return [
    vehicleName(model).full,
    engine?.code,
    power_kw && t('vehicleLabel.kw', { kw: power_kw }),
    years(t, vehicle),
    steering && t(`vehicleLabel.steering.${steering}`),
  ]
    .filter(Boolean)
    .join(', ');
};

export const openDataReferenceSchema = z.object({
  chassis: z.string(),
  model: z.string(),
  body: z.string().nullish(),
  engine: z.string().nullish(),
  power_kw: z.number().nullish(),
  drivetrain: z.enum(VEHICLE_DRIVES).nullish(),
  steering: z.enum(STEERING_SIDES).nullish(),
  from: z.string().nullable(),
  to: z.string().nullable(),
});

export type OpenDataReference = z.infer<typeof openDataReferenceSchema>;

export const openDataLine = (t: TFunction, reference: OpenDataReference) =>
  [
    [reference.chassis, reference.model, reference.body]
      .filter(Boolean)
      .join(' '),
    reference.engine,
    reference.power_kw && t('vehicleLabel.kw', { kw: reference.power_kw }),
    reference.drivetrain && t(`vehicles.values.drive.${reference.drivetrain}`),
    reference.steering && t(`vehicleLabel.steering.${reference.steering}`),
    yearSpan(t, reference.from, reference.to),
  ]
    .filter(Boolean)
    .join(', ');

export type ReferenceRow = { id: string } & Record<string, unknown>;

const referenceRowSchema = z.object({ id: z.string() }).loose();

const PARENTS: Record<string, [relation: string, collection: string]> = {
  series: ['make', 'makes'],
  chassis: ['series', 'series'],
  vehicle_models: ['chassis', 'chassis'],
};

export const referenceLabel = (
  collection: string,
  row: ReferenceRow,
): string => {
  const own = String(row.name ?? row.code ?? row.value ?? row.id);
  const [relation, parents] = PARENTS[collection] ?? [];
  const parent = relation && referenceRowSchema.safeParse(row[relation]);
  return parent && parent.success && parents
    ? `${referenceLabel(parents, parent.data)} ${own}`
    : own;
};
