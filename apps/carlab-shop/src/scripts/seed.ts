import { ExecArgs } from '@medusajs/framework/types';

import { seedCashAtPickupCommerceDefaults } from '../lib/commerce-defaults';
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
  return partId;
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

const CATEGORIES = [
  {
    slug: 'maintenance-consumables',
    name: 'ТО и расходники',
    text: 'Все для планового ТО, от фильтров до технических жидкостей. Подбираем точно под ваш VIN, в том числе для BMW, Mercedes-Benz и других европейских марок.',
  },
  {
    slug: 'brakes',
    name: 'Тормозная система',
    text: 'Колодки, диски и все, что с ними связано. Подбираем точно под модель и год выпуска.',
  },
  {
    slug: 'suspension',
    name: 'Подвеска и рулевое',
    text: 'От стука в подвеске до замены рулевых наконечников. Подберем деталь под ваш автомобиль.',
  },
  {
    slug: 'engine-parts',
    name: 'Двигатель',
    text: 'Запчасти для ремонта и обслуживания двигателя, от прокладок до турбины.',
  },
  {
    slug: 'electrics',
    name: 'Электрика',
    text: 'Электрика автомобиля, от аккумулятора до датчиков. Подберем деталь, которая точно подойдет.',
  },
  {
    slug: 'transmission',
    name: 'Трансмиссия и приводы',
    text: 'Детали трансмиссии и приводов, от сцепления до подшипников ступиц.',
  },
  {
    slug: 'body-parts',
    name: 'Кузовные детали',
    text: 'Кузовные детали после ДТП или просто на замену. Подберем по VIN, чтобы точно подошло.',
  },
];

async function seedCategories(
  catalog: CatalogModuleService,
  b47OilFilterPartId: string,
  logger: { info: (message: string) => void },
): Promise<void> {
  if ((await catalog.listCategories({ slug: CATEGORIES[0].slug })).length) {
    logger.info('Categories already seeded, skipping.');
    return;
  }
  const [maintenance] = await catalog.createCategories(CATEGORIES);
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
  logger.info('Seeded the Categories the placeholder pages redirect to.');
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
  await seedCategories(catalog, b47OilFilterPartId, logger);
}
