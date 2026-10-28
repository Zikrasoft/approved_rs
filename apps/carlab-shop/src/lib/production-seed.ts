import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { MedusaContainer } from '@medusajs/framework/types';
import {
  type CategoryFieldType,
  STAGED_DATA_KINDS,
} from '@podbor/catalog-contract';

import type { SupplierAdapterName } from './env';
import { slugOf } from './slug';
import { spellingKey } from './suppliers/spelling';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { seedCashAtPickupCommerceDefaults } from './commerce-defaults';
import { CRAWLED_SITES } from './crawler/sites';
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

type FieldDefinition = {
  key: string;
  type: CategoryFieldType;
  label: string;
  unit: string | null;
  facet: boolean;
  required: boolean;
  options: [string, string][];
};

const number = (
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

const select = (
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

export const BATTERY_FIELDS: FieldDefinition[] = [
  number('capacity', 'Емкость', 'А·ч', true, true),
  number('cold-cranking', 'Пусковой ток (EN)', 'А', true),
  number('voltage', 'Напряжение', 'В'),
  select('technology', 'Технология', true, true, [
    ['standard', 'Обычный'],
    ['efb', 'EFB'],
    ['agm', 'AGM'],
  ]),
  select('polarity', 'Полярность', false, false, [
    ['reverse', 'Обратная'],
    ['normal', 'Прямая'],
  ]),
  select('case-size', 'Типоразмер', false, false, [
    ['h5-l2', 'H5/L2'],
    ['h6-l3', 'H6/L3'],
    ['h7-l4', 'H7/L4'],
    ['h8-l5', 'H8/L5'],
    ['h9-l6', 'H9/L6'],
  ]),
  number('length', 'Длина', 'мм'),
  number('width', 'Ширина', 'мм'),
  number('height', 'Высота', 'мм'),
];

const IMAGES = join(process.cwd(), 'assets/categories');

const matches = (row: object, wanted: object) =>
  Object.entries(wanted).every(([key, value]) =>
    isDeepStrictEqual((row as Record<string, unknown>)[key], value),
  );

async function upsert<Row extends { id: string; updated_by: string | null }>(
  row: Row | undefined,
  wanted: object,
  create: () => Promise<Row>,
  update: (wanted: object & { id: string }) => Promise<unknown>,
): Promise<Row> {
  if (!row) return create();
  if (!row.updated_by && !matches(row, wanted)) {
    await update({ id: row.id, ...wanted });
  }
  return row;
}

export async function seedCategoryFields(
  catalog: CatalogModuleService,
  categoryId: string,
  definitions: FieldDefinition[],
): Promise<Record<string, string>> {
  const existing = await catalog.listCategoryFields(
    { category_id: categoryId },
    { take: null },
  );
  const ids: Record<string, string> = {};
  for (const [rank, { options, ...definition }] of definitions.entries()) {
    const wanted = { ...definition, rank };
    const field = await upsert(
      existing.find(({ key }) => key === definition.key),
      wanted,
      () =>
        catalog.createCategoryFields({ ...wanted, category_id: categoryId }),
      (update) => catalog.updateCategoryFields(update),
    );
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
    makes: { 'VW (VOLKSWAGEN)': 'Volkswagen' },
  },
  filtron: {
    brands: { FILTRON: ['FILTRON'] },
    categories: {},
    makes: {},
  },
  varta: {
    brands: { VARTA: ['VARTA'] },
    categories: { battery: BATTERY_CATEGORY.slug },
    makes: {},
  },
  bilstein: {
    brands: { febi: ['febi'], SWAG: ['SWAG'], 'Blue Print': ['Blue Print'] },
    categories: {},
    makes: { 'Volkswagen (VW)': 'Volkswagen' },
  },
};

const CRAWLED_SUPPLIER = {
  import_on_publish: false,
  released_kinds: [...STAGED_DATA_KINDS],
};

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

async function seedNamed<Row extends { id: string; updated_by: string | null }>(
  name: string,
  list: (filter: { slug: string }) => Promise<Row[]>,
  create: (data: { slug: string; name: string }) => Promise<Row>,
  update: (wanted: object & { id: string }) => Promise<unknown>,
) {
  const slug = slugOf(name);
  const [row] = await list({ slug });
  return upsert(row, { name }, () => create({ slug, name }), update);
}

async function seedSpellings<
  Row extends { id: string; value_key: string; updated_by: string | null },
  Owner extends object,
>(
  existing: Row[],
  wanted: [value: string, owner: Owner][],
  create: (value: string, owner: Owner) => Promise<Row>,
  update: (wanted: object & { id: string }) => Promise<unknown>,
) {
  for (const [value, owner] of wanted) {
    await upsert(
      existing.find(({ value_key }) => value_key === spellingKey(value)),
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

    const brandSpellings: [string, { brand_id: string }][] = [];
    for (const [name, values] of Object.entries(brands)) {
      const brand = await seedNamed(
        name,
        (filter) => catalog.listBrands(filter),
        (data) => catalog.createBrands(data),
        (update) => catalog.updateBrands(update),
      );
      for (const value of values)
        brandSpellings.push([value, { brand_id: brand.id }]);
    }
    await seedSpellings(
      await catalog.listBrandSpellings({ supplier_id }, { take: null }),
      brandSpellings,
      (value, owner) =>
        catalog.createBrandSpellings({ supplier_id, value, ...owner }),
      (update) => catalog.updateBrandSpellings(update),
    );

    const makeSpellings: [string, { make_id: string }][] = [];
    for (const [value, name] of Object.entries(makes)) {
      const make = await seedNamed(
        name,
        (filter) => catalog.listMakes(filter),
        (data) => catalog.createMakes(data),
        (update) => catalog.updateMakes(update),
      );
      makeSpellings.push([value, { make_id: make.id }]);
    }
    await seedSpellings(
      await catalog.listMakeSpellings({ supplier_id }, { take: null }),
      makeSpellings,
      (value, owner) =>
        catalog.createMakeSpellings({ supplier_id, value, ...owner }),
      (update) => catalog.updateMakeSpellings(update),
    );

    const mapped = await suppliers.listSupplierCategories(
      { supplier_id },
      { take: null },
    );
    for (const [code, slug] of Object.entries(categories)) {
      const [category] = await catalog.listCategories({ slug });
      await upsert(
        mapped.find(({ code_key }) => code_key === spellingKey(code)),
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
    if (category === BATTERY_CATEGORY) {
      await seedCategoryFields(catalog, row.id, BATTERY_FIELDS);
    }
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
