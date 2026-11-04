import { ExecArgs } from '@medusajs/framework/types';

import { seedProductionCatalogue } from '../lib/production-seed';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';

const BMW = { name: 'BMW', slug: 'bmw' };
const MANN_FILTER = { name: 'Mann-Filter', slug: 'mann-filter' };

const INTERCARS = { name: 'Intercars', markup_percentage: 20 };
const CARLAB_WAREHOUSE = { name: 'CarLab warehouse', markup_percentage: 15 };

async function seedB47OilFilterPart(
  catalog: CatalogModuleService,
  supplierService: SupplierModuleService,
  logger: { info: (message: string) => void },
): Promise<string> {
  const [existing] = await catalog.listPartIdentifiers({
    normalized_value: '11428575211',
  });
  if (existing) {
    logger.info('B47 oil filter fixture already seeded, skipping.');
    return existing.part_id;
  }

  const [bmw, mannFilter] = await catalog.createBrands([BMW, MANN_FILTER]);

  const [intercars, carlabWarehouse] = await supplierService.createSuppliers([
    INTERCARS,
    CARLAB_WAREHOUSE,
  ]);

  const partId = await catalog.createPartWithIdentifiers({
    name: 'Oil filter, BMW B47/B48 engines',
    identifiers: [
      { type: 'oem', brand_id: bmw.id, value: '11 42 8575211' },
      {
        type: 'manufacturer-number',
        brand_id: mannFilter.id,
        value: 'HU 816 x',
      },
    ],
  });
  const [oemIdentifier, mannIdentifier] = await Promise.all(
    [bmw.id, mannFilter.id].map(async (brand_id) => {
      const [identifier] = await catalog.listPartIdentifiers({
        part_id: partId,
        brand_id,
      });
      return identifier;
    }),
  );

  await supplierService.createSupplierOffers([
    {
      part_identifier_id: oemIdentifier.id,
      supplier_id: intercars.id,
      supplier_article_id: 'IC-11428575211',
      cost_price: 1542,
      stock_quantity: 12,
      lead_time_days: 0,
    },
    {
      part_identifier_id: mannIdentifier.id,
      supplier_id: intercars.id,
      supplier_article_id: 'IC-HU816X',
      cost_price: 1000,
      stock_quantity: 30,
      lead_time_days: 0,
    },
    {
      part_identifier_id: mannIdentifier.id,
      supplier_id: carlabWarehouse.id,
      supplier_article_id: 'WH-HU816X',
      cost_price: 1000,
      stock_quantity: 4,
      lead_time_days: 3,
    },
  ]);

  logger.info('Seeded B47 oil filter fixture.');
  return partId;
}

const SEED_TYPE_CODE = (family: string) => ({
  type: 'bmw-type-code' as const,
  value: `SEED-${family}`,
});

async function seedVehiclesAndFitment(
  catalog: CatalogModuleService,
  b47OilFilterPartId: string,
  logger: { info: (message: string) => void },
): Promise<void> {
  const [existing] = await catalog.listVehicleIdentifiers(
    SEED_TYPE_CODE('B47'),
  );
  if (existing) {
    logger.info('Vehicle/fitment pilot fixture already seeded, skipping.');
    return;
  }

  const make = await catalog.createMakes({ slug: 'bmw', name: 'BMW' });
  const series = await catalog.createSeries({
    make_id: make.id,
    name: '3 серия',
    translations: { sr: 'Serija 3', en: '3 Series' },
  });
  const chassis = await catalog.createChassis({
    series_id: series.id,
    code: 'F30',
    body_style: 'sedan',
    year_from: 2011,
    year_to: 2019,
  });
  const model = await catalog.createVehicleModels({
    chassis_id: chassis.id,
    slug: 'f30-320d',
    name: '320d',
  });
  const engines = await catalog.createEngines([
    { code: 'B47D20', family: 'B47', fuel: 'diesel', displacement_cc: 1995 },
    { code: 'N47D20', family: 'N47', fuel: 'diesel', displacement_cc: 1995 },
    { code: 'B48B20', family: 'B48', fuel: 'petrol', displacement_cc: 1998 },
  ]);

  const vehicles = await Promise.all(
    engines.map(async (engine) => {
      const vehicle = await catalog.createVehicles({
        model_id: model.id,
        engine_id: engine.id,
        drive: 'rwd',
      });
      await catalog.createVehicleIdentifiers({
        vehicle_id: vehicle.id,
        ...SEED_TYPE_CODE(engine.family),
      });
      return vehicle;
    }),
  );
  const [b47Vehicle, n47Vehicle] = vehicles;

  await catalog.createFitments({
    part_id: b47OilFilterPartId,
    vehicle_id: b47Vehicle.id,
  });

  const n47OilFilterPartWithUnresolvedSteering = await catalog.createParts({
    name: 'Oil filter, BMW N47 engines',
  });
  await catalog.createFitments([
    {
      part_id: n47OilFilterPartWithUnresolvedSteering.id,
      vehicle_id: n47Vehicle.id,
      steering: 'left',
    },
    {
      part_id: n47OilFilterPartWithUnresolvedSteering.id,
      vehicle_id: n47Vehicle.id,
      steering: 'right',
    },
  ]);

  logger.info('Seeded vehicle/fitment pilot fixture (N47/B47/B48).');
}

async function seedFilterTypeField(
  catalog: CatalogModuleService,
  b47OilFilterPartId: string,
  logger: { info: (message: string) => void },
): Promise<void> {
  const [maintenance] = await catalog.listCategories({
    slug: 'maintenance-consumables',
  });
  const fields = await catalog.listCategoryFields({
    category_id: maintenance.id,
    key: 'filter-type',
  });
  if (fields.length) {
    logger.info('Filter type field already seeded, skipping.');
    return;
  }
  const filterType = await catalog.createCategoryFields({
    category_id: maintenance.id,
    key: 'filter-type',
    type: 'single-select',
    label: 'Тип фильтра',
    facet: true,
  });
  await catalog.createCategoryFieldOptions([
    {
      field_id: filterType.id,
      key: 'cartridge',
      label: 'Сменный элемент',
      rank: 0,
    },
    {
      field_id: filterType.id,
      key: 'spin-on',
      label: 'Навинчиваемый',
      rank: 1,
    },
  ]);
  await catalog.classifyPart(b47OilFilterPartId, {
    category_id: maintenance.id,
    attributes: { 'filter-type': 'cartridge' },
  });
  logger.info('Seeded the filter type field on the maintenance Category.');
}

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve('logger');

  await seedProductionCatalogue(container);

  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const supplierService: SupplierModuleService =
    container.resolve(SUPPLIER_MODULE);

  const b47OilFilterPartId = await seedB47OilFilterPart(
    catalog,
    supplierService,
    logger,
  );
  await seedVehiclesAndFitment(catalog, b47OilFilterPartId, logger);
  await seedFilterTypeField(catalog, b47OilFilterPartId, logger);
}
