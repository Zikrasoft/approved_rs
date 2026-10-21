import { ExecArgs } from '@medusajs/framework/types';

import { seedCashAtPickupCommerceDefaults } from '../lib/commerce-defaults';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';

const OEM_IDENTIFIER = {
  type: 'oem' as const,
  brand: 'BMW',
  value: '11 42 8575211',
};

const MANUFACTURER_IDENTIFIER = {
  type: 'manufacturer-number' as const,
  brand: 'Mann-Filter',
  value: 'HU 816 x',
};

const INTERCARS = { name: 'Intercars', markup_percentage: 20 };
const CARLAB_WAREHOUSE = { name: 'CarLab warehouse', markup_percentage: 15 };

async function seedB47OilFilterPart(
  catalog: CatalogModuleService,
  supplierService: SupplierModuleService,
  logger: { info: (message: string) => void },
): Promise<string> {
  const [existing] = await catalog.listPartIdentifiers(OEM_IDENTIFIER);
  if (existing) {
    logger.info('B47 oil filter fixture already seeded, skipping.');
    return existing.part_id;
  }

  const [intercars, carlabWarehouse] = await supplierService.createSuppliers([
    INTERCARS,
    CARLAB_WAREHOUSE,
  ]);

  const part = await catalog.createParts({
    name: 'Oil filter, BMW B47/B48 engines',
  });

  const oemIdentifier = await catalog.createPartIdentifiers({
    part_id: part.id,
    ...OEM_IDENTIFIER,
  });

  const mannIdentifier = await catalog.createPartIdentifiers({
    part_id: part.id,
    ...MANUFACTURER_IDENTIFIER,
  });

  await supplierService.createSupplierOffers([
    {
      part_identifier_id: oemIdentifier.id,
      supplier_id: intercars.id,
      supplier_article_id: 'IC-11428575211',
      cost_price: 1542,
      stock_quantity: 12,
      lead_time: 'in_stock',
    },
    {
      part_identifier_id: mannIdentifier.id,
      supplier_id: intercars.id,
      supplier_article_id: 'IC-HU816X',
      cost_price: 1000,
      stock_quantity: 30,
      lead_time: 'in_stock',
    },
    {
      part_identifier_id: mannIdentifier.id,
      supplier_id: carlabWarehouse.id,
      supplier_article_id: 'WH-HU816X',
      cost_price: 1000,
      stock_quantity: 4,
      lead_time: '3_days',
    },
  ]);

  logger.info('Seeded B47 oil filter fixture.');
  return part.id;
}

const B47_VEHICLE_KTYPE = { type: 'ktype' as const, value: 'KTYPE-F30-B47' };

async function seedVehiclesAndFitment(
  catalog: CatalogModuleService,
  b47OilFilterPartId: string,
  logger: { info: (message: string) => void },
): Promise<void> {
  const [existing] = await catalog.listVehicleIdentifiers(B47_VEHICLE_KTYPE);
  if (existing) {
    logger.info('Vehicle/fitment pilot fixture already seeded, skipping.');
    return;
  }

  const b47Vehicle = await catalog.createVehicles({
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'B47',
    year_from: 2015,
    year_to: 2018,
  });
  await catalog.createVehicleIdentifiers({
    vehicle_id: b47Vehicle.id,
    ...B47_VEHICLE_KTYPE,
  });
  await catalog.createFitments({
    part_id: b47OilFilterPartId,
    vehicle_id: b47Vehicle.id,
  });

  const n47Vehicle = await catalog.createVehicles({
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'N47',
    year_from: 2010,
    year_to: 2012,
  });
  await catalog.createVehicleIdentifiers({
    vehicle_id: n47Vehicle.id,
    type: 'ktype',
    value: 'KTYPE-F30-N47',
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

  const b48Vehicle = await catalog.createVehicles({
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'B48',
    year_from: 2018,
    year_to: 2021,
  });
  await catalog.createVehicleIdentifiers({
    vehicle_id: b48Vehicle.id,
    type: 'ktype',
    value: 'KTYPE-F30-B48',
  });
  logger.info('Seeded vehicle/fitment pilot fixture (N47/B47/B48).');
}

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve('logger');

  await seedCashAtPickupCommerceDefaults(container);

  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const supplierService: SupplierModuleService =
    container.resolve(SUPPLIER_MODULE);

  const b47OilFilterPartId = await seedB47OilFilterPart(
    catalog,
    supplierService,
    logger,
  );
  await seedVehiclesAndFitment(catalog, b47OilFilterPartId, logger);
}
