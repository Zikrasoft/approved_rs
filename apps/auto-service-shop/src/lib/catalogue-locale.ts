import {
  CATALOG_TRANSLATION_LOCALES,
  translated,
  type CatalogLocale,
  type Vehicle,
} from '@podbor/catalog-contract';

type Translations = Partial<
  Record<
    (typeof CATALOG_TRANSLATION_LOCALES)[number],
    Record<string, string> | undefined
  >
> | null;

type Labelled = { label: string; translations: Translations };

const label = <Row extends Labelled>(row: Row, locale: CatalogLocale) => ({
  ...row,
  label: translated(row, 'label', locale),
  translations: null,
});

const SERVICE_COLUMNS = ['service_label', 'service_note'];

const serviceTranslations = (translations: Translations): Translations => {
  const kept = Object.fromEntries(
    CATALOG_TRANSLATION_LOCALES.flatMap((locale) => {
      const columns = Object.entries(translations?.[locale] ?? {}).filter(
        ([column]) => SERVICE_COLUMNS.includes(column),
      );
      return columns.length ? [[locale, Object.fromEntries(columns)]] : [];
    }),
  );
  return Object.keys(kept).length ? kept : null;
};

export const localizedCategory = <
  Category extends {
    name: string;
    text: string;
    translations: Translations;
    fields: (Labelled & { options: Labelled[] })[];
  },
>(
  category: Category,
  locale: CatalogLocale,
): Category => ({
  ...category,
  name: translated(category, 'name', locale),
  text: translated(category, 'text', locale),
  translations: serviceTranslations(category.translations),
  fields: category.fields.map((field) => ({
    ...label(field, locale),
    options: field.options.map((option) => label(option, locale)),
  })),
});

export const localizedSeries = <
  Series extends { name: string; translations: Translations },
>(
  series: Series,
  locale: CatalogLocale,
): Series => ({
  ...series,
  name: translated(series, 'name', locale),
  translations: null,
});

export const localizedVehicle = (
  vehicle: Vehicle,
  locale: CatalogLocale,
): Vehicle => ({
  ...vehicle,
  model: {
    ...vehicle.model,
    chassis: {
      ...vehicle.model.chassis,
      series: localizedSeries(vehicle.model.chassis.series, locale),
    },
  },
});
