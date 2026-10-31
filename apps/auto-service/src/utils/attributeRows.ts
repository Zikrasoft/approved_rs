import { isDeepStrictEqual } from 'node:util';
import {
  localizedUnit,
  translated,
  type AttributeValues,
  type Category,
  type CategoryField,
} from '@podbor/catalog-contract';
import { BCP47_BY_LOCALE, type Locale } from '@/i18n/config';

export type AttributeRow = { label: string; value: string };

type Booleans = { yes: string; no: string };

const displayValue = (
  field: CategoryField,
  value: AttributeValues[string],
  locale: Locale,
  { yes, no }: Booleans,
): string => {
  const option = (key: string) => {
    const found = field.options.find((candidate) => candidate.key === key);
    return found ? translated(found, 'label', locale) : key;
  };
  switch (field.type) {
    case 'boolean':
      return value ? yes : no;
    case 'multi-select':
      return [value].flat().map(String).map(option).join(', ');
    case 'single-select':
      return option(String(value));
    case 'number': {
      const number =
        typeof value === 'number'
          ? value.toLocaleString(BCP47_BY_LOCALE[locale])
          : String(value);
      return field.unit
        ? `${number} ${localizedUnit(field.unit, locale)}`
        : number;
    }
    case 'text':
      return String(value);
  }
};

export const attributeRows = (
  category: Category,
  values: AttributeValues,
  locale: Locale,
  booleans: Booleans,
): AttributeRow[] =>
  category.fields.flatMap((field) =>
    values[field.key] === undefined
      ? []
      : [
          {
            label: translated(field, 'label', locale),
            value: displayValue(field, values[field.key], locale, booleans),
          },
        ],
  );

export const keySpecs = (
  category: Category,
  values: AttributeValues,
  locale: Locale,
  listing: AttributeValues[] = [],
): string =>
  attributeRows(
    {
      ...category,
      fields: category.fields.filter(
        ({ key, type }) =>
          type !== 'boolean' &&
          !(
            listing.length > 1 &&
            listing.every((other) => isDeepStrictEqual(other[key], values[key]))
          ),
      ),
    },
    values,
    locale,
    { yes: '', no: '' },
  )
    .slice(0, 3)
    .map(({ value }) => value)
    .join(' · ');
