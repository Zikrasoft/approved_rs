import { ExecArgs } from '@medusajs/framework/types';

import { PART_MODULE } from '../modules/part';
import PartModuleService from '../modules/part/service';
import { seedCashAtPickupCommerceDefaults } from '../lib/commerce-defaults';
import { VEHICLE_MODULE } from '../modules/vehicle';
import VehicleModuleService from '../modules/vehicle/service';

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
  partModuleService: PartModuleService,
  logger: { info: (message: string) => void },
): Promise<string> {
  const [existing] =
    await partModuleService.listPartIdentifiers(OEM_IDENTIFIER);
  if (existing) {
    logger.info('B47 oil filter fixture already seeded, skipping.');
    return existing.part_id;
  }

  const [intercars, carlabWarehouse] = await partModuleService.createSuppliers([
    INTERCARS,
    CARLAB_WAREHOUSE,
  ]);

  const part = await partModuleService.createParts({
    name: 'Oil filter, BMW B47/B48 engines',
  });

  const oemIdentifier = await partModuleService.createPartIdentifiers({
    part_id: part.id,
    ...OEM_IDENTIFIER,
  });

  const mannIdentifier = await partModuleService.createPartIdentifiers({
    part_id: part.id,
    ...MANUFACTURER_IDENTIFIER,
  });

  await partModuleService.createSupplierOffers([
    {
      identifier_id: oemIdentifier.id,
      supplier_id: intercars.id,
      supplier_article_id: 'IC-11428575211',
      cost_price: 1542,
      stock_quantity: 12,
      lead_time: 'in_stock',
    },
    {
      identifier_id: mannIdentifier.id,
      supplier_id: intercars.id,
      supplier_article_id: 'IC-HU816X',
      cost_price: 1000,
      stock_quantity: 30,
      lead_time: 'in_stock',
    },
    {
      identifier_id: mannIdentifier.id,
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
  vehicleModuleService: VehicleModuleService,
  partModuleService: PartModuleService,
  b47OilFilterPartId: string,
  logger: { info: (message: string) => void },
): Promise<void> {
  const [existing] =
    await vehicleModuleService.listVehicleIdentifiers(B47_VEHICLE_KTYPE);
  if (existing) {
    logger.info('Vehicle/fitment pilot fixture already seeded, skipping.');
    return;
  }

  const b47Vehicle = await vehicleModuleService.createVehicles({
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'B47',
    year_from: 2015,
    year_to: 2018,
  });
  await vehicleModuleService.createVehicleIdentifiers({
    vehicle_id: b47Vehicle.id,
    ...B47_VEHICLE_KTYPE,
  });
  await vehicleModuleService.createFitments({
    part_id: b47OilFilterPartId,
    vehicle_id: b47Vehicle.id,
    source: 'manual',
    status: 'active',
  });

  const n47Vehicle = await vehicleModuleService.createVehicles({
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'N47',
    year_from: 2010,
    year_to: 2012,
  });
  await vehicleModuleService.createVehicleIdentifiers({
    vehicle_id: n47Vehicle.id,
    type: 'ktype',
    value: 'KTYPE-F30-N47',
  });

  const n47OilFilterPartWithUnresolvedSteering =
    await partModuleService.createParts({
      name: 'Oil filter, BMW N47 engines',
    });
  await vehicleModuleService.createFitments([
    {
      part_id: n47OilFilterPartWithUnresolvedSteering.id,
      vehicle_id: n47Vehicle.id,
      steering: 'left',
      source: 'manual',
      status: 'active',
    },
    {
      part_id: n47OilFilterPartWithUnresolvedSteering.id,
      vehicle_id: n47Vehicle.id,
      steering: 'right',
      source: 'manual',
      status: 'active',
    },
  ]);

  const b48Vehicle = await vehicleModuleService.createVehicles({
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'B48',
    year_from: 2018,
    year_to: 2021,
  });
  await vehicleModuleService.createVehicleIdentifiers({
    vehicle_id: b48Vehicle.id,
    type: 'ktype',
    value: 'KTYPE-F30-B48',
  });
  await vehicleModuleService.createFitments({
    part_id: b47OilFilterPartId,
    vehicle_id: b48Vehicle.id,
    source: 'auto:tecdoc',
    status: 'rejected',
  });

  logger.info('Seeded vehicle/fitment pilot fixture (N47/B47/B48).');
}

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve('logger');

  await seedCashAtPickupCommerceDefaults(container);

  const partModuleService: PartModuleService = container.resolve(PART_MODULE);
  const vehicleModuleService: VehicleModuleService =
    container.resolve(VEHICLE_MODULE);

  const b47OilFilterPartId = await seedB47OilFilterPart(
    partModuleService,
    logger,
  );
  await seedVehiclesAndFitment(
    vehicleModuleService,
    partModuleService,
    b47OilFilterPartId,
    logger,
  );
}
