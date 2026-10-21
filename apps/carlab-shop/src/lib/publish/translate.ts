import { MedusaError } from '@medusajs/framework/utils';
import { sha256Hex, translateFields } from '@podbor/i18n/translate/core';
import { z } from 'zod';

import type CatalogModuleService from '../../modules/catalog/service';

export const TARGET_LOCALES = ['sr', 'en'] as const;

export type TargetLocale = (typeof TARGET_LOCALES)[number];

const LANGUAGE_NAME: Record<TargetLocale, string> = {
  sr: 'Serbian (Latin script)',
  en: 'English',
};

const BUSINESS_DESCRIPTION =
  'CarLab, a car service in Belgrade, Serbia, with a parts shop for BMW and Mercedes-Benz';

const ROWS_PER_REQUEST = 50;

const localeSchema = z.enum(TARGET_LOCALES);
const nestedSchema = z
  .partialRecord(localeSchema, z.record(z.string(), z.string()))
  .nullable();
const flatSchema = z.partialRecord(localeSchema, z.string()).nullable();
const translatedFromSchema = z
  .partialRecord(localeSchema, z.string())
  .nullable();

export type Translations = NonNullable<z.infer<typeof nestedSchema>>;
type TranslatedFrom = NonNullable<z.infer<typeof translatedFromSchema>>;

type StoredRow = {
  id: string;
  translations?: unknown;
  translated_from?: unknown;
  [field: string]: unknown;
};

type TranslationUpdate = {
  id: string;
  translations: Record<string, unknown>;
  translated_from: TranslatedFrom;
};

type Codec = {
  decode: (stored: unknown) => Translations;
  encode: (translations: Translations) => Record<string, unknown>;
};

type TranslatableEntity = {
  subject: string;
  fields: readonly string[];
  codec: Codec;
  list: (
    catalog: CatalogModuleService,
    filters: { id?: string },
  ) => Promise<StoredRow[]>;
  update: (
    catalog: CatalogModuleService,
    rows: TranslationUpdate[],
  ) => Promise<unknown>;
};

const mapLocales = <From, To>(
  record: Partial<Record<TargetLocale, From>>,
  map: (value: From) => To,
): Partial<Record<TargetLocale, To>> =>
  Object.fromEntries(
    Object.entries(record).map(([locale, value]) => [
      locale,
      map(value as From),
    ]),
  );

const nested: Codec = {
  decode: (stored) => nestedSchema.parse(stored ?? null) ?? {},
  encode: (translations) => translations,
};

const flat = (field: string): Codec => ({
  decode: (stored) =>
    mapLocales(flatSchema.parse(stored ?? null) ?? {}, (text) => ({
      [field]: text,
    })),
  encode: (translations) => mapLocales(translations, (fields) => fields[field]),
});

const TRANSLATION_COLUMNS = ['id', 'translations', 'translated_from'];

export const TRANSLATABLE_ENTITIES = new Map<string, TranslatableEntity>([
  [
    'part',
    {
      subject: 'car part names in a parts catalogue',
      fields: ['name'],
      codec: nested,
      list: (catalog, filters) =>
        catalog.listParts(filters, {
          select: [...TRANSLATION_COLUMNS, 'name'],
          take: null,
        }),
      update: (catalog, rows) => catalog.updateParts(rows),
    },
  ],
  [
    'series',
    {
      subject: 'car model series names, such as "3 серия"',
      fields: ['name'],
      codec: flat('name'),
      list: (catalog, filters) =>
        catalog.listSeries(filters, {
          select: [...TRANSLATION_COLUMNS, 'name'],
          take: null,
        }),
      update: (catalog, rows) => catalog.updateSeries(rows),
    },
  ],
  [
    'category',
    {
      subject: 'car part category names and their descriptions',
      fields: ['name', 'text'],
      codec: nested,
      list: (catalog, filters) =>
        catalog.listCategories(filters, {
          select: [...TRANSLATION_COLUMNS, 'name', 'text'],
          take: null,
        }),
      update: (catalog, rows) => catalog.updateCategories(rows),
    },
  ],
  [
    'category_field',
    {
      subject: 'names of car part characteristics, such as "Вязкость"',
      fields: ['label'],
      codec: nested,
      list: (catalog, filters) =>
        catalog.listCategoryFields(filters, {
          select: [...TRANSLATION_COLUMNS, 'label'],
          take: null,
        }),
      update: (catalog, rows) => catalog.updateCategoryFields(rows),
    },
  ],
  [
    'category_field_option',
    {
      subject: 'values of car part characteristics, such as "Сменный элемент"',
      fields: ['label'],
      codec: nested,
      list: (catalog, filters) =>
        catalog.listCategoryFieldOptions(filters, {
          select: [...TRANSLATION_COLUMNS, 'label'],
          take: null,
        }),
      update: (catalog, rows) => catalog.updateCategoryFieldOptions(rows),
    },
  ],
]);

type Item = {
  id: string;
  source: Record<string, string>;
  hash: string;
  translations: Translations;
  translatedFrom: TranslatedFrom;
};

const itemOf = (entity: TranslatableEntity, row: StoredRow): Item => {
  const source = Object.fromEntries(
    entity.fields.flatMap((field) => {
      const value = row[field];
      return typeof value === 'string' && value.trim()
        ? [[field, value.trim()]]
        : [];
    }),
  );
  return {
    id: row.id,
    source,
    hash: sha256Hex(JSON.stringify(source)),
    translations: entity.codec.decode(row.translations),
    translatedFrom:
      translatedFromSchema.parse(row.translated_from ?? null) ?? {},
  };
};

const keptTranslation = (item: Item, locale: TargetLocale) => {
  if (item.translatedFrom[locale] !== undefined) {
    return {};
  }
  const written = item.translations[locale] ?? {};
  return Object.fromEntries(
    Object.keys(item.source).flatMap((field) =>
      written[field]?.trim() ? [[field, written[field]]] : [],
    ),
  );
};

const fieldKey = (id: string, field: string) => `${id}.${field}`;

const chunked = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

async function translateLocale(
  entity: TranslatableEntity,
  catalog: CatalogModuleService,
  items: Item[],
  locale: TargetLocale,
  apiKey: string | undefined,
): Promise<void> {
  const stale = items.filter(
    (item) => item.translatedFrom[locale] !== item.hash,
  );
  for (const chunk of chunked(stale, ROWS_PER_REQUEST)) {
    const fields = Object.fromEntries(
      chunk.flatMap((item) => {
        const kept = keptTranslation(item, locale);
        return Object.entries(item.source)
          .filter(([field]) => !(field in kept))
          .map(([field, text]) => [fieldKey(item.id, field), text]);
      }),
    );
    if (Object.keys(fields).length > 0 && !apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    const answer = await translateFields({
      fields,
      targetLocales: [locale],
      languageName: LANGUAGE_NAME,
      businessDescription: BUSINESS_DESCRIPTION,
      subject: entity.subject,
      apiKey: apiKey ?? '',
    });
    await entity.update(
      catalog,
      chunk.map((item) => {
        const kept = keptTranslation(item, locale);
        item.translations = {
          ...item.translations,
          [locale]: Object.fromEntries(
            Object.keys(item.source).map((field) => [
              field,
              kept[field] ?? answer[locale][fieldKey(item.id, field)],
            ]),
          ),
        };
        item.translatedFrom = { ...item.translatedFrom, [locale]: item.hash };
        return {
          id: item.id,
          translations: entity.codec.encode(item.translations),
          translated_from: item.translatedFrom,
        };
      }),
    );
  }
}

export async function translateCatalogue(
  catalog: CatalogModuleService,
  apiKey: string | undefined,
): Promise<void> {
  for (const entity of TRANSLATABLE_ENTITIES.values()) {
    const items = (await entity.list(catalog, {})).map((row) =>
      itemOf(entity, row),
    );
    for (const locale of TARGET_LOCALES) {
      await translateLocale(entity, catalog, items, locale, apiKey);
    }
  }
}

const entityNamed = (name: string): TranslatableEntity => {
  const entity = TRANSLATABLE_ENTITIES.get(name);
  if (!entity) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `${name} has no translations`,
    );
  }
  return entity;
};

async function storedItem(
  entity: TranslatableEntity,
  catalog: CatalogModuleService,
  id: string,
): Promise<Item> {
  const [row] = await entity.list(catalog, { id });
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `${id} was not found`);
  }
  return itemOf(entity, row);
}

export async function readTranslations(
  catalog: CatalogModuleService,
  name: string,
  id: string,
): Promise<Translations> {
  const entity = entityNamed(name);
  return (await storedItem(entity, catalog, id)).translations;
}

export async function editTranslation(
  catalog: CatalogModuleService,
  name: string,
  id: string,
  locale: TargetLocale,
  fields: Record<string, string>,
): Promise<Translations> {
  const entity = entityNamed(name);
  const unknown = Object.keys(fields).filter(
    (field) => !entity.fields.includes(field),
  );
  if (unknown.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${name} has no translatable ${unknown.join(', ')}`,
    );
  }
  const item = await storedItem(entity, catalog, id);
  const translations = {
    ...item.translations,
    [locale]: { ...item.translations[locale], ...fields },
  };
  await entity.update(catalog, [
    {
      id,
      translations: entity.codec.encode(translations),
      translated_from: { ...item.translatedFrom, [locale]: item.hash },
    },
  ]);
  return translations;
}
