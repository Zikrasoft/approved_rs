import { ExecArgs } from '@medusajs/framework/types';

import { PART_MODULE } from '../modules/part';
import PartModuleService from '../modules/part/service';

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

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve('logger');
  const partModuleService: PartModuleService = container.resolve(PART_MODULE);

  const [existing] =
    await partModuleService.listPartIdentifiers(OEM_IDENTIFIER);
  if (existing) {
    logger.info('B47 oil filter fixture already seeded, skipping.');
    return;
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
}
