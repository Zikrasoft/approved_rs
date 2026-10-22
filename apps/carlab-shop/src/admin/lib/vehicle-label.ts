import type { useTranslation } from 'react-i18next';
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
  engine: z.object({ code: z.string() }),
});

export type LabelledVehicle = z.infer<typeof labelledVehicleSchema>;

const years = (
  t: TFunction,
  { year_from, year_to }: LabelledVehicle,
): string | null => {
  if (year_from && year_to) {
    return t('vehicleLabel.between', { from: year_from, to: year_to });
  }
  if (year_from) return t('vehicleLabel.since', { from: year_from });
  return year_to ? t('vehicleLabel.until', { to: year_to }) : null;
};

export const vehicleLabel = (t: TFunction, vehicle: LabelledVehicle) => {
  const { model, engine, power_kw, steering } = vehicle;
  const series = model.chassis?.series;
  return [
    [series?.make?.name, series?.name, model.chassis?.code, model.name]
      .filter(Boolean)
      .join(' '),
    engine.code,
    power_kw && t('vehicleLabel.kw', { kw: power_kw }),
    years(t, vehicle),
    steering && t(`vehicleLabel.steering.${steering}`),
  ]
    .filter(Boolean)
    .join(', ');
};

export type ReferenceRow = { id: string } & Record<string, unknown>;

const PARENTS: Record<string, [key: string, collection: string]> = {
  series: ['make_id', 'makes'],
  chassis: ['series_id', 'series'],
  vehicle_models: ['chassis_id', 'chassis'],
};

export const referenceLabel = (
  rows: Record<string, ReferenceRow[] | undefined>,
  collection: string,
  row: ReferenceRow,
): string => {
  const own = String(row.name ?? row.code ?? row.value ?? row.id);
  const [key, parents] = PARENTS[collection] ?? [];
  const parent =
    key && parents && rows[parents]?.find(({ id }) => id === row[key]);
  return parent ? `${referenceLabel(rows, parents, parent)} ${own}` : own;
};
