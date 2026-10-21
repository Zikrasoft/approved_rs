import type CatalogModuleService from '../src/modules/catalog/service';

type FixtureOptions = {
  typeCode?: string;
  modelSlug?: string;
  chassisCode?: string;
  engineCode?: string;
  engineFamily?: string;
};

const firstOrCreate = async <T>(
  existing: Promise<T[]>,
  create: () => Promise<T>,
): Promise<T> => (await existing)[0] ?? create();

export const createVehicleFixture = async (
  catalog: CatalogModuleService,
  {
    typeCode = '35BG',
    modelSlug = 'f30-320d',
    chassisCode = 'F30',
    engineCode = 'B47D20O0',
    engineFamily = 'B47',
  }: FixtureOptions = {},
) => {
  const make = await firstOrCreate(catalog.listMakes({ slug: 'bmw' }), () =>
    catalog.createMakes({ slug: 'bmw', name: 'BMW' }),
  );
  const series = await firstOrCreate(
    catalog.listSeries({ make_id: make.id, name: '3 серия' }),
    () =>
      catalog.createSeries({
        make_id: make.id,
        name: '3 серия',
        translations: { sr: 'Serija 3', en: '3 Series' },
      }),
  );
  const chassis = await firstOrCreate(
    catalog.listChassis({ code: chassisCode }),
    () =>
      catalog.createChassis({
        series_id: series.id,
        code: chassisCode,
        body_style: 'sedan',
        year_from: 2011,
        year_to: 2019,
      }),
  );
  const model = await firstOrCreate(
    catalog.listVehicleModels({ slug: modelSlug }),
    () =>
      catalog.createVehicleModels({
        chassis_id: chassis.id,
        slug: modelSlug,
        name: '320d',
      }),
  );
  const engine = await firstOrCreate(
    catalog.listEngines({ code: engineCode }),
    () =>
      catalog.createEngines({
        code: engineCode,
        family: engineFamily,
        fuel: 'diesel',
        displacement_cc: 1995,
      }),
  );
  const vehicle = await catalog.createVehicles({
    model_id: model.id,
    engine_id: engine.id,
    power_kw: 140,
    drive: 'rwd',
    market: 'EU',
    year_from: 2015,
    year_to: 2019,
    steering: 'left',
  });
  await catalog.createVehicleIdentifiers({
    vehicle_id: vehicle.id,
    type: 'bmw-type-code',
    value: typeCode,
  });
  return { make, series, chassis, model, engine, vehicle };
};
