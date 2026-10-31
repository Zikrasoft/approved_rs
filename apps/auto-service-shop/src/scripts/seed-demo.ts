import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  ExecArgs,
  IApiKeyModuleService,
  IAuthModuleService,
  ISalesChannelModuleService,
  IUserModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import {
  type CategoryFieldType,
  normalizePartNumber,
} from '@podbor/catalog-contract';
import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from '@medusajs/medusa/core-flows';

import { seedCashAtPickupCommerceDefaults } from '../lib/commerce-defaults';
import {
  BATTERY_CATEGORY,
  BATTERY_FIELDS,
  CATEGORIES,
  seedCategoryFields,
  seedProductionCatalogue,
} from '../lib/production-seed';
import { DEMO_SUPPLIERS } from '../lib/suppliers/demo-adapter';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { seedDemoImages } from './seed-demo-images';

const DEMO_ADMIN = { email: 'admin@carlab.local', password: 'carlab-demo' };
const DEMO_KEY_TITLE = 'CarLab local demo storefront';
const STOREFRONT_ENV = resolve(process.cwd(), '../auto-service/.env.local');

type Logger = { info: (message: string) => void };

async function seedAdmin(container: MedusaContainer, logger: Logger) {
  const users: IUserModuleService = container.resolve(Modules.USER);
  if ((await users.listUsers({ email: DEMO_ADMIN.email })).length) {
    logger.info(`Demo admin ${DEMO_ADMIN.email} already exists.`);
    return;
  }
  const auth: IAuthModuleService = container.resolve(Modules.AUTH);
  const { authIdentity } = await auth.register('emailpass', {
    body: DEMO_ADMIN,
  });
  const user = await users.createUsers({
    email: DEMO_ADMIN.email,
    first_name: 'Demo',
    last_name: 'Admin',
  });
  await auth.updateAuthIdentities({
    id: authIdentity!.id,
    app_metadata: { user_id: user.id },
  });
  logger.info(
    `Demo admin: ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password} (local demo only).`,
  );
}

async function seedPublishableKey(container: MedusaContainer): Promise<string> {
  const apiKeys: IApiKeyModuleService = container.resolve(Modules.API_KEY);
  const [existing] = await apiKeys.listApiKeys({ title: DEMO_KEY_TITLE });
  if (existing) {
    return existing.token;
  }
  const channels: ISalesChannelModuleService = container.resolve(
    Modules.SALES_CHANNEL,
  );
  const [channel] = await channels.listSalesChannels({
    name: 'CarLab parts shop',
  });
  const {
    result: [key],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        { title: DEMO_KEY_TITLE, type: 'publishable', created_by: 'seed-demo' },
      ],
    },
  });
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: key.id, add: [channel.id] },
  });
  return key.token;
}

const gitIgnored = (path: string): boolean => {
  try {
    execFileSync('git', ['check-ignore', '-q', path]);
    return true;
  } catch {
    return false;
  }
};

function writeStorefrontEnv(token: string, logger: Logger) {
  if (!gitIgnored(STOREFRONT_ENV)) {
    logger.info(
      `${STOREFRONT_ENV} is not gitignored; set MEDUSA_PUBLISHABLE_KEY=${token} yourself.`,
    );
    return;
  }
  const wanted: Record<string, string> = {
    MEDUSA_BACKEND_URL: 'http://localhost:9009',
    MEDUSA_PUBLISHABLE_KEY: token,
  };
  const current = existsSync(STOREFRONT_ENV)
    ? readFileSync(STOREFRONT_ENV, 'utf8').trimEnd()
    : '';
  const kept = (current ? current.split('\n') : []).filter(
    (line) => !(line.split('=')[0] in wanted),
  );
  writeFileSync(
    STOREFRONT_ENV,
    [...kept, ...Object.entries(wanted).map(([k, v]) => `${k}=${v}`)].join(
      '\n',
    ) + '\n',
  );
  logger.info(
    `Wrote MEDUSA_BACKEND_URL and MEDUSA_PUBLISHABLE_KEY to ${STOREFRONT_ENV}.`,
  );
}

const BRANDS = [
  { slug: 'bmw', name: 'BMW' },
  { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
  { slug: 'mann-filter', name: 'Mann-Filter' },
  { slug: 'mahle', name: 'Mahle' },
  { slug: 'ate', name: 'ATE' },
  { slug: 'trw', name: 'TRW' },
  { slug: 'textar', name: 'Textar' },
  { slug: 'castrol', name: 'Castrol' },
  { slug: 'bosch', name: 'Bosch' },
];

type Ids = Record<string, string>;

async function seedVehicles(catalog: CatalogModuleService) {
  const [bmw, mercedes] = await catalog.createMakes([
    { slug: 'bmw', name: 'BMW' },
    { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
  ]);
  const [series3, series5, eClass] = await catalog.createSeries([
    {
      make_id: bmw.id,
      name: '3 серия',
      translations: { sr: 'Serija 3', en: '3 Series' },
    },
    {
      make_id: bmw.id,
      name: '5 серия',
      translations: { sr: 'Serija 5', en: '5 Series' },
    },
    {
      make_id: mercedes.id,
      name: 'E-класс',
      translations: { sr: 'E-klasa', en: 'E-Class' },
    },
  ]);
  const [f30, g30, w213] = await catalog.createChassis([
    {
      series_id: series3.id,
      code: 'F30',
      body_style: 'sedan',
      year_from: 2011,
      year_to: 2019,
    },
    {
      series_id: series5.id,
      code: 'G30',
      body_style: 'sedan',
      year_from: 2016,
      year_to: 2023,
    },
    {
      series_id: eClass.id,
      code: 'W213',
      body_style: 'sedan',
      year_from: 2016,
      year_to: 2023,
    },
  ]);
  const [m320d, m320i, m520d, e220d] = await catalog.createVehicleModels([
    { chassis_id: f30.id, slug: 'f30-320d', name: '320d' },
    { chassis_id: f30.id, slug: 'f30-320i', name: '320i' },
    { chassis_id: g30.id, slug: 'g30-520d', name: '520d' },
    { chassis_id: w213.id, slug: 'w213-e220d', name: 'E 220 d' },
  ]);
  const [b47, b48, om654] = await catalog.createEngines([
    { code: 'B47D20', family: 'B47', fuel: 'diesel', displacement_cc: 1995 },
    { code: 'B48B20', family: 'B48', fuel: 'petrol', displacement_cc: 1998 },
    {
      code: 'OM654.920',
      family: 'OM654',
      fuel: 'diesel',
      displacement_cc: 1950,
    },
  ]);
  const vehicles = await catalog.createVehicles([
    {
      model_id: m320d.id,
      engine_id: b47.id,
      power_kw: 140,
      drive: 'rwd',
      market: 'EU',
      year_from: 2015,
      year_to: 2019,
      steering: 'left',
    },
    {
      model_id: m320i.id,
      engine_id: b48.id,
      power_kw: 135,
      drive: 'rwd',
      market: 'EU',
      year_from: 2015,
      year_to: 2019,
      steering: 'left',
    },
    {
      model_id: m520d.id,
      engine_id: b47.id,
      power_kw: 140,
      drive: 'rwd',
      market: 'EU',
      year_from: 2017,
      year_to: 2023,
      steering: 'left',
    },
    {
      model_id: e220d.id,
      engine_id: om654.id,
      power_kw: 143,
      drive: 'rwd',
      market: 'EU',
      year_from: 2016,
      year_to: 2023,
    },
  ]);
  const [v320d, v320i, v520d, vE220d] = vehicles;
  await catalog.createVehicleIdentifiers([
    { vehicle_id: v320d.id, type: 'bmw-type-code', value: '35BG' },
    { vehicle_id: v320i.id, type: 'bmw-type-code', value: '8E31' },
    { vehicle_id: v520d.id, type: 'bmw-type-code', value: 'JA31' },
    { vehicle_id: vE220d.id, type: 'mercedes-baumuster', value: '213004' },
  ]);
  return { b47, om654, v320d, v320i, v520d, vE220d };
}

async function seedCategories(catalog: CatalogModuleService) {
  await catalog.createCategories(CATEGORIES);
  const [oil, filters, pads] = await catalog.createCategories([
    {
      slug: 'engine-oil',
      name: 'Моторное масло',
      text: 'Масло под допуск производителя и вязкость вашего двигателя.',
      maintenance_kit: true,
      kit_rank: 0,
    },
    {
      slug: 'oil-filters',
      name: 'Масляные фильтры',
      text: 'Масляные фильтры под двигатель вашего автомобиля.',
      maintenance_kit: true,
      kit_rank: 1,
    },
    {
      slug: 'brake-pads',
      name: 'Тормозные колодки',
      text: 'Передние и задние колодки под ваш автомобиль.',
    },
  ]);
  const [viscosity, approvals, volume, filterType, axle] =
    await catalog.createCategoryFields([
      {
        category_id: oil.id,
        key: 'viscosity',
        type: 'single-select',
        label: 'Вязкость',
        required: true,
        facet: true,
        rank: 0,
      },
      {
        category_id: oil.id,
        key: 'approvals',
        type: 'multi-select',
        label: 'Допуски',
        facet: true,
        rank: 1,
      },
      {
        category_id: oil.id,
        key: 'volume',
        type: 'number',
        unit: 'л',
        label: 'Объем',
        rank: 2,
      },
      {
        category_id: filters.id,
        key: 'filter-type',
        type: 'single-select',
        label: 'Тип фильтра',
        facet: true,
      },
      {
        category_id: pads.id,
        key: 'axle',
        type: 'single-select',
        label: 'Ось',
        required: true,
        facet: true,
      },
    ]);
  const options = (field: { id: string }, entries: [string, string][]) =>
    entries.map(([key, label], rank) => ({
      field_id: field.id,
      key,
      label,
      rank,
    }));
  await catalog.createCategoryFieldOptions([
    ...options(viscosity, [
      ['0w-20', '0W-20'],
      ['0w-30', '0W-30'],
      ['5w-30', '5W-30'],
      ['5w-40', '5W-40'],
    ]),
    ...options(approvals, [
      ['bmw-ll-04', 'BMW Longlife-04'],
      ['bmw-ll-17fe', 'BMW Longlife-17 FE+'],
      ['mb-229-51', 'MB 229.51'],
      ['mb-229-52', 'MB 229.52'],
      ['mb-229-71', 'MB 229.71'],
    ]),
    ...options(filterType, [
      ['cartridge', 'Сменный элемент'],
      ['spin-on', 'Навинчиваемый'],
    ]),
    ...options(axle, [
      ['front', 'Передняя'],
      ['rear', 'Задняя'],
    ]),
  ]);
  return { oil, filters, pads, viscosity, approvals, volume };
}

async function seedParts(
  catalog: CatalogModuleService,
  brand: Ids,
  category: Ids,
) {
  const part = (
    name: string,
    categoryId: string | null,
    attributes: Record<string, unknown>,
    identifiers: [string, 'oem' | 'manufacturer-number', string][],
  ) =>
    catalog.createPartWithIdentifiers({
      name,
      category_id: categoryId,
      attributes,
      identifiers: identifiers.map(([slug, type, value]) => ({
        type,
        brand_id: brand[slug],
        value,
      })),
    });
  const b47OilFilter = await part(
    'Масляный фильтр BMW B47/B48',
    category.filters,
    { 'filter-type': 'cartridge' },
    [
      ['bmw', 'oem', '11 42 8 575 211'],
      ['bmw', 'oem', '11 42 8 507 683'],
      ['mann-filter', 'manufacturer-number', 'HU 816 x'],
      ['mahle', 'manufacturer-number', 'OX 404D'],
    ],
  );
  const [superseded] = await catalog.listPartIdentifiers({
    part_id: b47OilFilter,
    normalized_value: '11428507683',
  });
  await catalog.updatePartIdentifiers({ id: superseded.id, superseded: true });
  const om654OilFilter = await part(
    'Масляный фильтр Mercedes OM654',
    category.filters,
    { 'filter-type': 'cartridge' },
    [
      ['mercedes-benz', 'oem', 'A 654 180 01 00'],
      ['mann-filter', 'manufacturer-number', 'HU 6020 z'],
    ],
  );
  const frontPads = await part(
    'Тормозные колодки передние',
    category.pads,
    { axle: 'front' },
    [
      ['bmw', 'oem', '34 11 6 860 242'],
      ['ate', 'manufacturer-number', '13.0460-2786.2'],
    ],
  );
  const frontSportPads = await part(
    'Тормозные колодки передние, M Sport',
    category.pads,
    { axle: 'front' },
    [['trw', 'manufacturer-number', 'GDB2033']],
  );
  const oldFrontPads = await part(
    'Тормозные колодки передние, прежнее исполнение',
    category.pads,
    { axle: 'front' },
    [['ate', 'manufacturer-number', '13.0460-7217.2']],
  );
  await catalog.replacePart(oldFrontPads, frontPads, null);
  const rearPads = await part(
    'Тормозные колодки задние',
    category.pads,
    { axle: 'rear' },
    [
      ['bmw', 'oem', '34 21 6 873 093'],
      ['textar', 'manufacturer-number', '2459801'],
    ],
  );
  const oil5w30 = await part(
    'Моторное масло Castrol EDGE 5W-30 LL, 5 л',
    category.oil,
    {
      viscosity: '5w-30',
      approvals: ['bmw-ll-04', 'mb-229-51'],
      volume: 5,
    },
    [['castrol', 'manufacturer-number', '15669E']],
  );
  await part(
    'Моторное масло Castrol EDGE 0W-20 V, 5 л',
    category.oil,
    {
      viscosity: '0w-20',
      approvals: ['bmw-ll-17fe', 'mb-229-71'],
      volume: 5,
    },
    [['castrol', 'manufacturer-number', '15F6E1']],
  );
  const wipersLeft = await part(
    'Щетки стеклоочистителя, левый руль',
    category['maintenance-consumables'],
    {},
    [['bosch', 'manufacturer-number', '3 397 007 297']],
  );
  const wipersRight = await part(
    'Щетки стеклоочистителя, правый руль',
    category['maintenance-consumables'],
    {},
    [['bosch', 'manufacturer-number', '3 397 007 460']],
  );
  await part('Датчик давления масла', null, {}, [
    ['bmw', 'oem', '12 61 7 568 480'],
  ]);
  return {
    b47OilFilter,
    om654OilFilter,
    frontPads,
    frontSportPads,
    rearPads,
    oil5w30,
    wipersLeft,
    wipersRight,
  };
}

async function seedCatalogue(catalog: CatalogModuleService, logger: Logger) {
  const brands = await catalog.createBrands(BRANDS);
  const brand: Ids = Object.fromEntries(brands.map((b) => [b.slug, b.id]));
  const { b47, om654, v320d, v320i, v520d, vE220d } =
    await seedVehicles(catalog);
  const { viscosity, approvals, ...made } = await seedCategories(catalog);
  const category: Ids = Object.fromEntries(
    (await catalog.listCategories({}, { take: null })).map((c) => [
      c.slug,
      c.id,
    ]),
  );
  Object.assign(category, {
    oil: made.oil.id,
    filters: made.filters.id,
    pads: made.pads.id,
  });

  await catalog.createRequirement({
    field_id: viscosity.id,
    engine_id: b47.id,
    option_keys: ['5w-30', '0w-30'],
    min: null,
    max: null,
    quantity: 1,
  });
  await catalog.createRequirement({
    field_id: approvals.id,
    engine_id: b47.id,
    option_keys: ['bmw-ll-04'],
    min: null,
    max: null,
    quantity: 1,
  });
  await catalog.createRequirement({
    field_id: approvals.id,
    engine_id: om654.id,
    option_keys: ['mb-229-51', 'mb-229-52'],
    min: null,
    max: null,
    quantity: 2,
  });

  const parts = await seedParts(catalog, brand, category);
  await catalog.createFitments([
    ...[v320d, v520d].map(({ id }) => ({
      part_id: parts.b47OilFilter,
      vehicle_id: id,
    })),
    { part_id: parts.b47OilFilter, vehicle_id: v320i.id },
    { part_id: parts.om654OilFilter, vehicle_id: vE220d.id },
    {
      part_id: parts.frontPads,
      vehicle_id: v320d.id,
      axle: 'front' as const,
    },
    {
      part_id: parts.frontSportPads,
      vehicle_id: v320d.id,
      axle: 'front' as const,
      note: 'Только для автомобилей с тормозами M Sport',
    },
    { part_id: parts.frontPads, vehicle_id: v320i.id, axle: 'front' as const },
    { part_id: parts.rearPads, vehicle_id: v320d.id, axle: 'rear' as const },
    {
      part_id: parts.wipersLeft,
      vehicle_id: vE220d.id,
      steering: 'left' as const,
    },
    {
      part_id: parts.wipersRight,
      vehicle_id: vE220d.id,
      steering: 'right' as const,
    },
  ]);

  logger.info('Seeded the demo catalogue and vehicles.');
}

const BATTERIES: {
  name: string;
  brand: string;
  number: string;
  attributes: Record<string, string | number>;
}[] = [
  {
    name: 'Аккумулятор Varta Silver Dynamic AGM G14, 80 А·ч',
    brand: 'varta',
    number: '580 901 080',
    attributes: {
      capacity: 80,
      'cold-cranking': 800,
      technology: 'agm',
      polarity: 'reverse',
      'case-size': 'h7-l4',
      length: 315,
      height: 190,
    },
  },
  {
    name: 'Аккумулятор Bosch S5 A13 AGM, 95 А·ч',
    brand: 'bosch',
    number: '0 092 S5A 130',
    attributes: {
      capacity: 95,
      'cold-cranking': 850,
      technology: 'agm',
      polarity: 'reverse',
      'case-size': 'h8-l5',
      length: 353,
      height: 190,
    },
  },
  {
    name: 'Аккумулятор Exide AGM EK700, 70 А·ч',
    brand: 'exide',
    number: 'EK700',
    attributes: {
      capacity: 70,
      'cold-cranking': 760,
      technology: 'agm',
      polarity: 'reverse',
      'case-size': 'h6-l3',
      length: 278,
      height: 190,
    },
  },
  {
    name: 'Аккумулятор Varta Blue Dynamic EFB N80, 80 А·ч',
    brand: 'varta',
    number: '580 500 080',
    attributes: {
      capacity: 80,
      'cold-cranking': 800,
      technology: 'efb',
      polarity: 'reverse',
      'case-size': 'h7-l4',
      length: 315,
      height: 190,
    },
  },
  {
    name: 'Аккумулятор Exide Excell EB741, 74 А·ч',
    brand: 'exide',
    number: 'EB741',
    attributes: {
      capacity: 74,
      'cold-cranking': 680,
      technology: 'standard',
      polarity: 'normal',
      'case-size': 'h6-l3',
      length: 278,
      height: 175,
    },
  },
];

async function seedBatteries(catalog: CatalogModuleService, logger: Logger) {
  const brands = await catalog.createBrands([
    { slug: 'varta', name: 'Varta' },
    { slug: 'exide', name: 'Exide' },
  ]);
  const [bosch] = await catalog.listBrands({ slug: 'bosch' });
  const brand: Ids = Object.fromEntries(
    [...brands, bosch].map((b) => [b.slug, b.id]),
  );
  const category = await catalog.createCategories(BATTERY_CATEGORY);
  const field = await seedCategoryFields(catalog, category.id, BATTERY_FIELDS);
  for (const { name, brand: slug, number, attributes } of BATTERIES) {
    await catalog.createPartWithIdentifiers({
      name,
      category_id: category.id,
      attributes: { voltage: 12, width: 175, ...attributes },
      identifiers: [
        { type: 'manufacturer-number', brand_id: brand[slug], value: number },
      ],
    });
  }
  const engines = await catalog.listEngines({ family: ['B47', 'OM654'] });
  const engine = Object.fromEntries(engines.map((e) => [e.family, e.id]));
  const requirement = (
    family: string,
    key: string,
    rule: { option_keys?: string[]; min?: number },
  ) =>
    catalog.createRequirement({
      field_id: field[key],
      engine_id: engine[family],
      option_keys: rule.option_keys ?? null,
      min: rule.min ?? null,
      max: null,
      quantity: 1,
    });
  await requirement('B47', 'technology', { option_keys: ['agm'] });
  await requirement('B47', 'capacity', { min: 80 });
  await requirement('B47', 'cold-cranking', { min: 800 });
  await requirement('B47', 'polarity', { option_keys: ['reverse'] });
  await requirement('B47', 'case-size', { option_keys: ['h7-l4', 'h8-l5'] });
  await requirement('OM654', 'technology', { option_keys: ['agm'] });
  await requirement('OM654', 'capacity', { min: 80 });
  logger.info('Seeded the demo batteries.');
}

const VARIETY_BRANDS = [
  { slug: 'hengst', name: 'Hengst' },
  { slug: 'knecht', name: 'Knecht' },
  { slug: 'febi', name: 'Febi' },
  { slug: 'brembo', name: 'Brembo' },
  { slug: 'zimmermann', name: 'Zimmermann' },
];

const OIL_FILTER_FIELDS = [
  ['height', 'number', 'Высота', 'мм'],
  ['outer-diameter', 'number', 'Наружный диаметр', 'мм'],
  ['thread', 'text', 'Резьба', null],
  ['gasket-included', 'boolean', 'Уплотнение в комплекте', null],
] as const;

const BRAKE_PAD_FIELDS = [
  ['thickness', 'number', 'Толщина', 'мм'],
  ['wear-sensor', 'single-select', 'Датчик износа', null],
] as const;

const WEAR_SENSOR_OPTIONS: [string, string][] = [
  ['included', 'В комплекте'],
  ['prepared', 'Подготовлены под датчик'],
  ['none', 'Без датчика'],
];

type VarietyPart = {
  name: string;
  brand: string;
  number: string;
  attributes: Record<string, string | number | boolean>;
};

const cartridge = (height: number, diameter: number, gasket: boolean) => ({
  'filter-type': 'cartridge',
  height,
  'outer-diameter': diameter,
  'gasket-included': gasket,
});

const spinOn = (height: number, diameter: number, thread: string) => ({
  'filter-type': 'spin-on',
  height,
  'outer-diameter': diameter,
  thread,
  'gasket-included': true,
});

const pads = (axle: string, thickness: number, sensor: string) => ({
  axle,
  thickness,
  'wear-sensor': sensor,
});

const EXISTING_ATTRIBUTES: [string, string, Record<string, unknown>][] = [
  ['mann-filter', 'HU816X', cartridge(125, 65, true)],
  ['mann-filter', 'HU6020Z', cartridge(154, 64, true)],
  ['ate', '13046027862', pads('front', 20, 'prepared')],
  ['trw', 'GDB2033', pads('front', 20.3, 'prepared')],
  ['ate', '13046072172', pads('front', 19.5, 'none')],
  ['textar', '2459801', pads('rear', 17, 'prepared')],
];

const VARIETY_PARTS: { category: string; parts: VarietyPart[] }[] = [
  {
    category: 'oil-filters',
    parts: [
      {
        name: 'Масляный фильтр Mann-Filter W 712/75',
        brand: 'mann-filter',
        number: 'W 712/75',
        attributes: spinOn(79, 76, 'M20x1.5'),
      },
      {
        name: 'Масляный фильтр Mann-Filter W 610/3',
        brand: 'mann-filter',
        number: 'W 610/3',
        attributes: spinOn(66, 76, '3/4-16 UNF'),
      },
      {
        name: 'Масляный фильтр Mahle OC 90',
        brand: 'mahle',
        number: 'OC 90',
        attributes: spinOn(79, 76, '3/4-16 UNF'),
      },
      {
        name: 'Масляный фильтр Bosch F 026 407 236',
        brand: 'bosch',
        number: 'F 026 407 236',
        attributes: spinOn(86, 76, 'M20x1.5'),
      },
      {
        name: 'Масляный фильтр Hengst H90W24',
        brand: 'hengst',
        number: 'H90W24',
        attributes: spinOn(96, 76, 'M20x1.5'),
      },
      {
        name: 'Масляный фильтр Hengst E340H D247',
        brand: 'hengst',
        number: 'E340H D247',
        attributes: cartridge(141, 71, true),
      },
      {
        name: 'Масляный фильтр Knecht OX 371D',
        brand: 'knecht',
        number: 'OX 371D',
        attributes: cartridge(115, 64, true),
      },
      {
        name: 'Масляный фильтр Febi 27150',
        brand: 'febi',
        number: '27150',
        attributes: cartridge(103, 65, false),
      },
    ],
  },
  {
    category: 'brake-pads',
    parts: [
      {
        name: 'Тормозные колодки передние Brembo P 06 038',
        brand: 'brembo',
        number: 'P 06 038',
        attributes: pads('front', 20.3, 'prepared'),
      },
      {
        name: 'Тормозные колодки передние Zimmermann 23921.200.1',
        brand: 'zimmermann',
        number: '23921.200.1',
        attributes: pads('front', 20, 'prepared'),
      },
      {
        name: 'Тормозные колодки передние Textar 2412201',
        brand: 'textar',
        number: '2412201',
        attributes: pads('front', 19.8, 'included'),
      },
      {
        name: 'Тормозные колодки задние TRW GDB1919',
        brand: 'trw',
        number: 'GDB1919',
        attributes: pads('rear', 17.5, 'prepared'),
      },
      {
        name: 'Тормозные колодки задние ATE 13.0460-7230.2',
        brand: 'ate',
        number: '13.0460-7230.2',
        attributes: pads('rear', 17.2, 'included'),
      },
      {
        name: 'Тормозные колодки задние Brembo P 06 087',
        brand: 'brembo',
        number: 'P 06 087',
        attributes: pads('rear', 16.8, 'none'),
      },
    ],
  },
];

async function seedFilterVariety(
  catalog: CatalogModuleService,
  logger: Logger,
) {
  const known = new Set(
    (await catalog.listBrands({}, { take: null })).map(({ slug }) => slug),
  );
  await catalog.createBrands(
    VARIETY_BRANDS.filter(({ slug }) => !known.has(slug)),
  );
  const brand: Ids = Object.fromEntries(
    (await catalog.listBrands({}, { take: null })).map((b) => [b.slug, b.id]),
  );
  const category: Ids = Object.fromEntries(
    (await catalog.listCategories({}, { take: null })).map((c) => [
      c.slug,
      c.id,
    ]),
  );
  const addFields = (
    categoryId: string,
    fields: readonly (readonly [
      string,
      CategoryFieldType,
      string,
      string | null,
    ])[],
  ) =>
    catalog.createCategoryFields(
      fields.map(([key, type, label, unit], index) => ({
        category_id: categoryId,
        key,
        type,
        label,
        unit,
        facet: true,
        rank: 10 + index,
      })),
    );
  await addFields(category['oil-filters'], OIL_FILTER_FIELDS);
  const [, sensor] = await addFields(category['brake-pads'], BRAKE_PAD_FIELDS);
  await catalog.createCategoryFieldOptions(
    WEAR_SENSOR_OPTIONS.map(([key, label], rank) => ({
      field_id: sensor.id,
      key,
      label,
      rank,
    })),
  );
  const existing = async (slug: string, number: string) => {
    const [identifier] = await catalog.listPartIdentifiers(
      { brand_id: brand[slug], normalized_value: normalizePartNumber(number) },
      { relations: ['part'] },
    );
    return identifier;
  };
  for (const [slug, number, attributes] of EXISTING_ATTRIBUTES) {
    const identifier = await existing(slug, number);
    if (identifier) {
      await catalog.classifyPart(identifier.part_id, {
        category_id: identifier.part.category_id,
        attributes: { ...identifier.part.attributes, ...attributes },
      });
    }
  }
  for (const { category: slug, parts } of VARIETY_PARTS) {
    for (const { name, brand: brandSlug, number, attributes } of parts) {
      const imported = await existing(brandSlug, number);
      if (imported) {
        await catalog.classifyPart(imported.part_id, {
          category_id: category[slug],
          attributes,
        });
        continue;
      }
      await catalog.createPartWithIdentifiers({
        name,
        category_id: category[slug],
        attributes,
        identifiers: [
          {
            type: 'manufacturer-number',
            brand_id: brand[brandSlug],
            value: number,
          },
        ],
      });
    }
  }
  logger.info('Seeded the demo oil filter and brake pad variety.');
}

async function syncDemoSuppliers(
  catalog: CatalogModuleService,
  suppliers: SupplierModuleService,
) {
  const category: Ids = Object.fromEntries(
    (await catalog.listCategories({}, { take: null })).map((c) => [
      c.slug,
      c.id,
    ]),
  );
  const brand: Ids = Object.fromEntries(
    (await catalog.listBrands({}, { take: null })).map((b) => [b.slug, b.id]),
  );
  for (const {
    name,
    markup_percentage,
    categories,
    spellings,
  } of DEMO_SUPPLIERS) {
    const [found] = await suppliers.listSuppliers({ name });
    const supplier =
      found ?? (await suppliers.createSuppliers({ name, markup_percentage }));
    const mapped = new Set(
      (
        await suppliers.listSupplierCategories(
          { supplier_id: supplier.id },
          { take: null },
        )
      ).map(({ code }) => code),
    );
    await suppliers.createSupplierCategories(
      Object.entries(categories)
        .filter(([code, slug]) => !mapped.has(code) && category[slug])
        .map(([code, slug]) => ({
          supplier_id: supplier.id,
          code,
          category_id: category[slug],
        })),
    );
    const spelled = new Set(
      (
        await catalog.listBrandSpellings(
          { supplier_id: supplier.id },
          { take: null },
        )
      ).map(({ value }) => value),
    );
    await catalog.createBrandSpellings(
      Object.entries(spellings)
        .filter(([value, slug]) => !spelled.has(value) && brand[slug])
        .map(([value, slug]) => ({
          supplier_id: supplier.id,
          value,
          brand_id: brand[slug],
        })),
    );
  }
}

export default async function seedDemo({ container }: ExecArgs) {
  const logger: Logger = container.resolve('logger');
  await seedCashAtPickupCommerceDefaults(container);
  await seedAdmin(container, logger);
  writeStorefrontEnv(await seedPublishableKey(container), logger);

  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = container.resolve(SUPPLIER_MODULE);
  if (
    (await suppliers.listSuppliers({ name: DEMO_SUPPLIERS[0].name })).length
  ) {
    logger.info('Demo catalogue already seeded, skipping.');
  } else {
    await seedCatalogue(catalog, logger);
  }
  if ((await catalog.listCategories({ slug: 'batteries' })).length) {
    logger.info('Demo batteries already seeded, skipping.');
  } else {
    await seedBatteries(catalog, logger);
  }
  const [oilFilters] = await catalog.listCategories({ slug: 'oil-filters' });
  if (
    (
      await catalog.listCategoryFields({
        category_id: oilFilters.id,
        key: 'height',
      })
    ).length
  ) {
    logger.info('Demo filter variety already seeded, skipping.');
  } else {
    await seedFilterVariety(catalog, logger);
  }
  await syncDemoSuppliers(catalog, suppliers);
  await seedDemoImages(container, catalog);
  logger.info('Seeded the demo images.');
  await seedProductionCatalogue(container);
}
