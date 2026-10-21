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
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from '@medusajs/medusa/core-flows';

import { seedCashAtPickupCommerceDefaults } from '../lib/commerce-defaults';
import { DEMO_SUPPLIERS } from '../lib/suppliers/demo-adapter';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { CATEGORIES } from './seed';

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
      text: 'Масляные фильтры для BMW и Mercedes-Benz.',
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
    category['body-parts'],
    {},
    [['bosch', 'manufacturer-number', '3 397 007 297']],
  );
  const wipersRight = await part(
    'Щетки стеклоочистителя, правый руль',
    category['body-parts'],
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

async function seedCatalogue(
  catalog: CatalogModuleService,
  suppliers: SupplierModuleService,
  logger: Logger,
) {
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
    quantity: 5,
  });
  await catalog.createRequirement({
    field_id: approvals.id,
    engine_id: b47.id,
    option_keys: ['bmw-ll-04'],
    min: null,
    max: null,
    quantity: 5,
  });
  await catalog.createRequirement({
    field_id: approvals.id,
    engine_id: om654.id,
    option_keys: ['mb-229-51', 'mb-229-52'],
    min: null,
    max: null,
    quantity: 7,
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

  for (const {
    name,
    markup_percentage,
    categories,
    spellings,
  } of DEMO_SUPPLIERS) {
    const supplier = await suppliers.createSuppliers({
      name,
      markup_percentage,
    });
    await suppliers.createSupplierCategories(
      Object.entries(categories).map(([code, slug]) => ({
        supplier_id: supplier.id,
        code,
        category_id: category[slug],
      })),
    );
    await catalog.createBrandSpellings(
      Object.entries(spellings).map(([value, slug]) => ({
        supplier_id: supplier.id,
        value,
        brand_id: brand[slug],
      })),
    );
  }
  logger.info('Seeded the demo catalogue, vehicles and demo suppliers.');
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
    return;
  }
  await seedCatalogue(catalog, suppliers, logger);
}
