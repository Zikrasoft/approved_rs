import type { Vehicle } from '@podbor/catalog-contract';

import type CatalogModuleService from '../../modules/catalog/service';
import { listVehicleResponses } from '../store-response';
import { vinModelYears } from './model-year';
import { type VagModelCode, vagModelCodes } from './vag-model-codes';

const TYPE_TOKEN = /^[A-Z0-9]{2,3}$/;

const chassisTypes = (code: string) =>
  code
    .toUpperCase()
    .split(/[\s/,]+/)
    .filter((token) => TYPE_TOKEN.test(token));

const carriesType = (chassisCode: string, types: string[]) =>
  chassisTypes(chassisCode).some((token) =>
    types.some((type) => token.startsWith(type)),
  );

const within = (year: number, from: number | null, to: number | null) =>
  (from === null || year >= from - 1) && (to === null || year <= to + 1);

const describes = (
  row: VagModelCode,
  modelYears: number[],
  { model, year_from, year_to }: Vehicle,
) =>
  model.chassis.series.make.slug === row.make &&
  carriesType(model.chassis.code, row.types) &&
  (!modelYears.length ||
    modelYears.some(
      (year) =>
        within(year, row.from, row.to) && within(year, year_from, year_to),
    ));

export const vagModelCodeMatches = (
  rows: VagModelCode[],
  modelYears: number[],
  vehicles: Vehicle[],
): Vehicle[] =>
  vehicles.filter((vehicle) =>
    rows.some((row) => describes(row, modelYears, vehicle)),
  );

export const vehiclesOfVagModelCode = async (
  catalog: CatalogModuleService,
  make: string,
  code: string,
  vin: string,
): Promise<Vehicle[]> => {
  const rows = vagModelCodes(make, code);
  if (!rows.length) return [];
  const makes = new Set<string>(rows.map((row) => row.make));
  const chassisIds = (
    await catalog.listChassis(
      {
        $or: [...new Set(rows.flatMap(({ types }) => types))].map((type) => ({
          code: { $ilike: `%${type}%` },
        })),
      },
      { relations: ['series.make'], take: null },
    )
  )
    .filter(({ series }) => makes.has(series.make.slug))
    .map(({ id }) => id);
  if (!chassisIds.length) return [];
  const modelIds = (
    await catalog.listVehicleModels(
      { chassis_id: chassisIds },
      { select: ['id'], take: null },
    )
  ).map(({ id }) => id);
  if (!modelIds.length) return [];
  return vagModelCodeMatches(
    rows,
    vinModelYears(vin),
    await listVehicleResponses(catalog, { model_id: modelIds }),
  );
};
