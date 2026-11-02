import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  type CategoryFieldType,
  STAGED_DATA_KINDS,
} from '@podbor/catalog-contract';

import type { SupplierAdapterName } from './env';
import { slugOf } from '../modules/_shared/slug';
import { MAKE_ALIASES } from './suppliers/makes';
import { spellingKey } from '../modules/_shared/spelling';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { seedCashAtPickupCommerceDefaults } from './commerce-defaults';
import { CRAWLED_SITES } from './crawler/sites';
import { errorMessage } from './errors';
import { storeImage } from './images';

export const CATEGORIES = [
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

export const BATTERY_CATEGORY = {
  slug: 'batteries',
  name: 'Аккумуляторы',
  text: 'Стартерные аккумуляторы, в том числе AGM и EFB для автомобилей с системой старт-стоп. Подбираем по емкости, пусковому току, полярности и типоразмеру под ваш автомобиль.',
  service_label: 'Регистрация аккумулятора в блоке управления',
  service_price: 2500,
  service_note:
    'На BMW и Mercedes-Benz после замены аккумулятор нужно зарегистрировать в блоке управления, иначе генератор будет заряжать его неправильно.',
};

export type FieldDefinition = {
  key: string;
  type: CategoryFieldType;
  label: string;
  unit: string | null;
  facet: boolean;
  required: boolean;
  options: [string, string][];
};

export const number = (
  key: string,
  label: string,
  unit: string,
  facet = false,
  required = false,
): FieldDefinition => ({
  key,
  type: 'number',
  label,
  unit,
  facet,
  required,
  options: [],
});

export const yesNo = (
  key: string,
  label: string,
  facet: boolean,
): FieldDefinition => ({
  key,
  type: 'boolean',
  label,
  unit: null,
  facet,
  required: false,
  options: [],
});

export const select = (
  key: string,
  label: string,
  facet: boolean,
  required: boolean,
  options: [string, string][],
): FieldDefinition => ({
  key,
  type: 'single-select',
  label,
  unit: null,
  facet,
  required,
  options,
});

export const START_STOP = {
  field: 'start-stop',
  technologyField: 'technology',
  technologies: ['agm', 'efb'],
};

export const BATTERY_FIELDS: FieldDefinition[] = [
  number('capacity', 'Емкость', 'А·ч', true, true),
  number('cold-cranking', 'Пусковой ток (EN)', 'А', true),
  number('voltage', 'Напряжение', 'В'),
  select('technology', 'Технология', true, true, [
    ['standard', 'Обычный'],
    ['efb', 'EFB'],
    ['agm', 'AGM'],
    ['lithium', 'Литий-ионный'],
  ]),
  yesNo(START_STOP.field, 'Подходит для Start-Stop', true),
  select('polarity', 'Полярность', true, false, [
    ['reverse', 'Обратная'],
    ['normal', 'Прямая'],
  ]),
  select('case-size', 'Типоразмер', true, false, [
    ['h5-l2', 'H5/L2'],
    ['h6-l3', 'H6/L3'],
    ['h7-l4', 'H7/L4'],
    ['h8-l5', 'H8/L5'],
    ['h9-l6', 'H9/L6'],
  ]),
  number('length', 'Длина', 'мм', true),
  number('width', 'Ширина', 'мм', true),
  number('height', 'Высота', 'мм', true),
  select('terminal-type', 'Тип клемм', true, false, [
    ['standard', 'Стандартные конусные'],
    ['thin', 'Тонкие (Asia, JIS)'],
    ['screw', 'Под болт'],
  ]),
  select('terminal-layout', 'Расположение клемм', true, false, [
    ['long-side', 'Вдоль длинной стороны'],
    ['short-side', 'Вдоль короткой стороны'],
    ['diagonal', 'По диагонали'],
  ]),
];

const multiSelect = (
  key: string,
  label: string,
  options: [string, string][],
): FieldDefinition => ({
  ...select(key, label, true, false, options),
  type: 'multi-select',
});

export const OIL_FIELDS: FieldDefinition[] = [
  select('viscosity', 'Вязкость', true, true, [
    ['0w-20', '0W-20'],
    ['0w-30', '0W-30'],
    ['5w-30', '5W-30'],
    ['5w-40', '5W-40'],
    ['10w-40', '10W-40'],
  ]),
  multiSelect('approvals', 'Допуски', [
    ['bmw-ll-04', 'BMW Longlife-04'],
    ['bmw-ll-17fe', 'BMW Longlife-17 FE+'],
    ['mb-229-51', 'MB 229.51'],
    ['mb-229-52', 'MB 229.52'],
    ['mb-229-71', 'MB 229.71'],
  ]),
  number('volume', 'Объем', 'л', true),
  select('base', 'Основа', true, false, [
    ['synthetic', 'Синтетическое'],
    ['semi-synthetic', 'Полусинтетическое'],
    ['mineral', 'Минеральное'],
  ]),
  multiSelect('acea', 'Класс ACEA', [
    ['a3-b4', 'A3/B4'],
    ['a5-b5', 'A5/B5'],
    ['c2', 'C2'],
    ['c3', 'C3'],
    ['c5', 'C5'],
    ['c6', 'C6'],
  ]),
  multiSelect('api', 'Класс API', [
    ['sn', 'SN'],
    ['sp', 'SP'],
    ['cf', 'CF'],
    ['ck-4', 'CK-4'],
  ]),
];

export const OIL_FILTER_FIELDS: FieldDefinition[] = [
  select('filter-type', 'Тип фильтра', true, false, [
    ['cartridge', 'Сменный элемент'],
    ['spin-on', 'Навинчиваемый'],
  ]),
  number('height', 'Высота', 'мм', true),
  number('outer-diameter', 'Наружный диаметр', 'мм', true),
  number('inner-diameter', 'Внутренний диаметр', 'мм', true),
  {
    key: 'thread',
    type: 'text',
    label: 'Резьба',
    unit: null,
    facet: true,
    required: false,
    options: [],
  },
  yesNo('gasket-included', 'Уплотнение в комплекте', true),
  yesNo('bypass-valve', 'Перепускной клапан', true),
];

export const BRAKE_PAD_FIELDS: FieldDefinition[] = [
  select('axle', 'Ось', true, true, [
    ['front', 'Передняя'],
    ['rear', 'Задняя'],
  ]),
  number('thickness', 'Толщина', 'мм', true),
  number('width', 'Ширина', 'мм', true),
  number('height', 'Высота', 'мм', true),
  select('brake-system', 'Тормозная система', true, false, [
    ['ate', 'ATE'],
    ['bosch', 'Bosch'],
    ['lucas-trw', 'Lucas/TRW'],
    ['akebono', 'Akebono'],
    ['brembo', 'Brembo'],
    ['sumitomo', 'Sumitomo'],
  ]),
  select('wear-sensor', 'Датчик износа', true, false, [
    ['included', 'В комплекте'],
    ['prepared', 'Подготовлены под датчик'],
    ['none', 'Без датчика'],
  ]),
];

const optional = (fields: FieldDefinition[]) =>
  fields.map((field) => ({ ...field, required: false }));

export const CATEGORY_FIELDS: Record<string, FieldDefinition[]> = {
  [BATTERY_CATEGORY.slug]: BATTERY_FIELDS,
  'maintenance-consumables': optional([
    ...OIL_FIELDS,
    ...OIL_FILTER_FIELDS,
    number('length', 'Длина', 'мм', true),
  ]),
  brakes: optional([
    ...BRAKE_PAD_FIELDS,
    number('diameter', 'Диаметр', 'мм', true),
  ]),
};

const IMAGES = join(process.cwd(), 'assets/categories');

const matches = (row: object, wanted: object) =>
  Object.entries(wanted).every(([key, value]) =>
    isDeepStrictEqual((row as Record<string, unknown>)[key], value),
  );

type Seeded = {
  id: string;
  updated_by: string | null;
  deleted_at?: Date | null;
};

async function upsert<Row extends Seeded>(
  row: Row | undefined,
  wanted: object,
  create: () => Promise<Row>,
  update: (wanted: object & { id: string }) => Promise<unknown>,
): Promise<Row> {
  if (!row) return create();
  if (!row.updated_by && !row.deleted_at && !matches(row, wanted)) {
    await update({ id: row.id, ...wanted });
  }
  return row;
}

const DEFINITION_REFUSALS = ['DEFINITION_BREAKS_PARTS', 'REQUIREMENT_IN_USE'];

const refusedDefinition = (error: unknown) =>
  MedusaError.isMedusaError(error) &&
  DEFINITION_REFUSALS.includes(String(error.code));

export async function seedCategoryFields(
  catalog: CatalogModuleService,
  categoryId: string,
  definitions: FieldDefinition[],
  logger?: Pick<Logger, 'warn'>,
): Promise<Record<string, string>> {
  const existing = await catalog.listCategoryFields(
    { category_id: categoryId },
    { take: null },
  );
  const ids: Record<string, string> = {};
  for (const [rank, { options, ...definition }] of definitions.entries()) {
    const wanted = { ...definition, rank };
    const stored = existing.find(({ key }) => key === definition.key);
    const field = await upsert(
      stored,
      wanted,
      () =>
        catalog.createCategoryFields({ ...wanted, category_id: categoryId }),
      (update) => catalog.updateCategoryFields(update),
    ).catch((error: unknown) => {
      if (!logger || !refusedDefinition(error)) throw error;
      logger.warn(
        `Category ${categoryId} keeps field ${definition.key} as stored: ${errorMessage(error)}. Migrate its Parts first.`,
      );
      return stored;
    });
    if (!field) continue;
    ids[field.key] = field.id;
    const existingOptions = await catalog.listCategoryFieldOptions(
      { field_id: field.id },
      { take: null },
    );
    for (const [optionRank, [key, label]] of options.entries()) {
      await upsert(
        existingOptions.find((option) => option.key === key),
        { key, label, rank: optionRank },
        () =>
          catalog.createCategoryFieldOptions({
            field_id: field.id,
            key,
            label,
            rank: optionRank,
          }),
        (update) => catalog.updateCategoryFieldOptions(update),
      );
    }
  }
  return ids;
}

type CrawledCatalogue = {
  brands: Record<string, string[]>;
  categories: Record<string, string>;
  makes: Record<string, string>;
};

const CRAWLED_CATALOGUES: Record<
  Exclude<SupplierAdapterName, 'demo'>,
  CrawledCatalogue
> = {
  'mann-filter': {
    brands: { 'MANN-FILTER': ['MANN-FILTER'] },
    categories: {},
    makes: MAKE_ALIASES,
  },
  filtron: {
    brands: { FILTRON: ['FILTRON'] },
    categories: {},
    makes: MAKE_ALIASES,
  },
  varta: {
    brands: { VARTA: ['VARTA'] },
    categories: { battery: BATTERY_CATEGORY.slug },
    makes: {},
  },
  bilstein: {
    brands: { Febi: ['febi'], SWAG: ['SWAG'], 'Blue Print': ['Blue Print'] },
    categories: {},
    makes: MAKE_ALIASES,
  },
};

const CRAWLED_SUPPLIER = { released_kinds: [...STAGED_DATA_KINDS] };

async function seedCrawledSupplier(
  suppliers: SupplierModuleService,
  name: string,
) {
  const [row] = await suppliers.listSuppliers({ name });
  return upsert(
    row,
    CRAWLED_SUPPLIER,
    () =>
      suppliers.createSuppliers({
        name,
        markup_percentage: 0,
        ...CRAWLED_SUPPLIER,
      }),
    (update) => suppliers.updateSuppliers(update),
  );
}

const liveFirst = <Row extends Seeded>(
  rows: Row[],
  wanted: (row: Row) => boolean,
) => rows.find((row) => wanted(row) && !row.deleted_at) ?? rows.find(wanted);

const WITH_DELETED = { take: null, withDeleted: true };

async function seedNamed<Row extends Seeded & { name: string; slug: string }>(
  name: string,
  spelledId: string | undefined,
  list: () => Promise<Row[]>,
  create: (data: { name: string }) => Promise<Row>,
  update: (wanted: object & { id: string }) => Promise<unknown>,
) {
  const rows = await list();
  const row =
    rows.find(
      (candidate) => spellingKey(candidate.name) === spellingKey(name),
    ) ??
    rows.find(({ slug }) => slug === slugOf(name)) ??
    rows.find(({ id }) => id === spelledId);
  return upsert(row, { name }, () => create({ name }), update);
}

const spelledOwner = <Row extends Seeded & { value_key: string }>(
  existing: Row[],
  value: string,
  owner: (row: Row) => string,
) => {
  const row = existing.find(
    (candidate) =>
      candidate.value_key === spellingKey(value) && !candidate.deleted_at,
  );
  return row && owner(row);
};

async function seedSpellings<
  Row extends Seeded & { value_key: string },
  Owner extends object,
>(
  existing: Row[],
  wanted: [value: string, owner: Owner][],
  create: (value: string, owner: Owner) => Promise<Row>,
  update: (wanted: object & { id: string }) => Promise<unknown>,
) {
  for (const [value, owner] of wanted) {
    await upsert(
      liveFirst(existing, ({ value_key }) => value_key === spellingKey(value)),
      owner,
      () => create(value, owner),
      update,
    );
  }
}

async function seedCrawledCatalogues(container: MedusaContainer) {
  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = container.resolve(SUPPLIER_MODULE);
  for (const site of CRAWLED_SITES) {
    if (site.key === 'demo') continue;
    const { brands, categories, makes } = CRAWLED_CATALOGUES[site.key];
    const { id: supplier_id } = await seedCrawledSupplier(suppliers, site.name);

    const seededBrandSpellings = await catalog.listBrandSpellings(
      { supplier_id },
      WITH_DELETED,
    );
    const brandSpellings: [string, { brand_id: string }][] = [];
    for (const [name, values] of Object.entries(brands)) {
      const brand = await seedNamed(
        name,
        values
          .map((value) =>
            spelledOwner(seededBrandSpellings, value, (row) => row.brand_id),
          )
          .find(Boolean),
        () => catalog.listBrands({}, { take: null }),
        (data) => catalog.createBrands(data),
        (update) => catalog.updateBrands(update),
      );
      for (const value of values)
        brandSpellings.push([value, { brand_id: brand.id }]);
    }
    await seedSpellings(
      seededBrandSpellings,
      brandSpellings,
      (value, owner) =>
        catalog.createBrandSpellings({ supplier_id, value, ...owner }),
      (update) => catalog.updateBrandSpellings(update),
    );

    const seededMakeSpellings = await catalog.listMakeSpellings(
      { supplier_id },
      WITH_DELETED,
    );
    const makeSpellings: [string, { make_id: string }][] = [];
    for (const [value, name] of Object.entries(makes)) {
      const make = await seedNamed(
        name,
        spelledOwner(seededMakeSpellings, value, (row) => row.make_id),
        () => catalog.listMakes({}, { take: null }),
        (data) => catalog.createMakes(data),
        (update) => catalog.updateMakes(update),
      );
      makeSpellings.push([value, { make_id: make.id }]);
    }
    await seedSpellings(
      seededMakeSpellings,
      makeSpellings,
      (value, owner) =>
        catalog.createMakeSpellings({ supplier_id, value, ...owner }),
      (update) => catalog.updateMakeSpellings(update),
    );

    const mapped = await suppliers.listSupplierCategories(
      { supplier_id },
      WITH_DELETED,
    );
    for (const [code, slug] of Object.entries(categories)) {
      const [category] = await catalog.listCategories({ slug });
      await upsert(
        liveFirst(mapped, ({ code_key }) => code_key === spellingKey(code)),
        { category_id: category.id },
        () =>
          suppliers.createSupplierCategories({
            supplier_id,
            code,
            category_id: category.id,
          }),
        (update) => suppliers.updateSupplierCategories(update),
      );
    }
  }
}

export async function seedProductionCatalogue(
  container: MedusaContainer,
): Promise<void> {
  await seedCashAtPickupCommerceDefaults(container);

  const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const categories = [...CATEGORIES, BATTERY_CATEGORY];
  const existing = await catalog.listCategories(
    { slug: categories.map(({ slug }) => slug) },
    { take: null },
  );
  const photos = readdirSync(IMAGES);
  for (const category of categories) {
    const row =
      existing.find(({ slug }) => slug === category.slug) ??
      (await catalog.createCategories(category));
    const fields = CATEGORY_FIELDS[category.slug];
    if (fields) await seedCategoryFields(catalog, row.id, fields, logger);
    if (row.updated_by) continue;
    const photo = photos.find((file) => file.startsWith(`${category.slug}.`));
    if ((row.image || !photo) && matches(row, category)) continue;
    const image =
      row.image ??
      (photo
        ? await storeImage(
            container,
            readFileSync(join(IMAGES, photo)),
            `categories/${row.id}`,
            null,
          )
        : null);
    await catalog.updateCategories({ id: row.id, ...category, image });
  }
  await seedCrawledCatalogues(container);
}
