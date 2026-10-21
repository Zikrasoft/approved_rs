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
const translationsSchema = z
  .partialRecord(localeSchema, z.record(z.string(), z.string()))
  .nullable();
const translatedFromSchema = z
  .partialRecord(localeSchema, z.string())
  .nullable();

export type Translations = NonNullable<z.infer<typeof translationsSchema>>;
type TranslatedFrom = NonNullable<z.infer<typeof translatedFromSchema>>;

type StoredRow = {
  id: string;
  translations?: unknown;
  translated_from?: unknown;
  [field: string]: unknown;
};

type TranslationUpdate = {
  id: string;
  translations: Translations;
  translated_from: TranslatedFrom;
};

type TranslatableEntity = {
  subject: string;
  fields: readonly string[];
  list: (
    catalog: CatalogModuleService,
    filters: { id?: string },
  ) => Promise<StoredRow[]>;
  update: (
    catalog: CatalogModuleService,
    rows: TranslationUpdate[],
  ) => Promise<unknown>;
};

const TRANSLATION_COLUMNS = ['id', 'translations', 'translated_from'];

export const TRANSLATABLE_ENTITIES = new Map<string, TranslatableEntity>([
  [
    'part',
    {
      subject: 'car part names in a parts catalogue',
      fields: ['name'],
      list: (catalog, filters) =>
        catalog.listParts(filters, {
          select: [...TRANSLATION_COLUMNS, 'name'],
          take: null,
        }),
      update: (catalog, rows) => catalog.updateParts(rows),
    },
  ],
]);

type Pending = {
  id: string;
  source: Record<string, string>;
  hash: string;
  locales: TargetLocale[];
  translations: Translations;
  translatedFrom: TranslatedFrom;
};

const sourceOf = (row: StoredRow, fields: readonly string[]) =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const value = row[field];
      return typeof value === 'string' && value.trim()
        ? [[field, value.trim()]]
        : [];
    }),
  );

const pendingOf = (row: StoredRow, fields: readonly string[]): Pending => {
  const source = sourceOf(row, fields);
  const hash = sha256Hex(JSON.stringify(source));
  const translatedFrom =
    translatedFromSchema.parse(row.translated_from ?? null) ?? {};
  return {
    id: row.id,
    source,
    hash,
    locales: TARGET_LOCALES.filter((locale) => translatedFrom[locale] !== hash),
    translations: translationsSchema.parse(row.translations ?? null) ?? {},
    translatedFrom,
  };
};

const chunked = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

const byLocales = (pending: Pending[]): Pending[][] => {
  const groups = new Map<string, Pending[]>();
  for (const item of pending) {
    const key = item.locales.join();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
};

const fieldKey = (id: string, field: string) => `${id}.${field}`;

async function translateChunk(
  entity: TranslatableEntity,
  catalog: CatalogModuleService,
  chunk: Pending[],
  apiKey: string,
): Promise<void> {
  const locales = chunk[0].locales;
  const answer = await translateFields({
    fields: Object.fromEntries(
      chunk.flatMap((item) =>
        Object.entries(item.source).map(([field, text]) => [
          fieldKey(item.id, field),
          text,
        ]),
      ),
    ),
    targetLocales: locales,
    languageName: LANGUAGE_NAME,
    businessDescription: BUSINESS_DESCRIPTION,
    subject: entity.subject,
    apiKey,
  });
  await entity.update(
    catalog,
    chunk.map((item) => ({
      id: item.id,
      translations: {
        ...item.translations,
        ...Object.fromEntries(
          locales.map((locale) => [
            locale,
            Object.fromEntries(
              Object.keys(item.source).map((field) => [
                field,
                answer[locale][fieldKey(item.id, field)],
              ]),
            ),
          ]),
        ),
      },
      translated_from: {
        ...item.translatedFrom,
        ...Object.fromEntries(locales.map((locale) => [locale, item.hash])),
      },
    })),
  );
}

export async function translateCatalogue(
  catalog: CatalogModuleService,
  apiKey: string | undefined,
): Promise<void> {
  for (const entity of TRANSLATABLE_ENTITIES.values()) {
    const pending = (await entity.list(catalog, {}))
      .map((row) => pendingOf(row, entity.fields))
      .filter((item) => item.locales.length > 0);
    if (pending.length > 0 && !apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    for (const group of byLocales(pending)) {
      for (const chunk of chunked(group, ROWS_PER_REQUEST)) {
        await translateChunk(entity, catalog, chunk, apiKey!);
      }
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

async function storedRow(
  entity: TranslatableEntity,
  catalog: CatalogModuleService,
  id: string,
): Promise<StoredRow> {
  const [row] = await entity.list(catalog, { id });
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `${id} was not found`);
  }
  return row;
}

export async function readTranslations(
  catalog: CatalogModuleService,
  name: string,
  id: string,
): Promise<Translations | null> {
  const row = await storedRow(entityNamed(name), catalog, id);
  return translationsSchema.parse(row.translations ?? null);
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
  const item = pendingOf(await storedRow(entity, catalog, id), entity.fields);
  const translations = {
    ...item.translations,
    [locale]: { ...item.translations[locale], ...fields },
  };
  await entity.update(catalog, [
    {
      id,
      translations,
      translated_from: { ...item.translatedFrom, [locale]: item.hash },
    },
  ]);
  return translations;
}
