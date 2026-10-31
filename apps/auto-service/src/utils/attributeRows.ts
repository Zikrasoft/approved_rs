import {
  localizedUnit,
  translated,
  type AttributeValues,
  type Category,
  type CategoryField,
} from '@podbor/catalog-contract';

export type AttributeRow = { label: string; value: string };

type Booleans = { yes: string; no: string };

const displayValue = (
  field: CategoryField,
  value: AttributeValues[string],
  locale: string,
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
    case 'number':
      return field.unit
        ? `${value} ${localizedUnit(field.unit, locale)}`
        : String(value);
    case 'text':
      return String(value);
  }
};

export const attributeRows = (
  category: Category,
  values: AttributeValues,
  locale: string,
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
  locale: string,
): string =>
  attributeRows(
    {
      ...category,
      fields: category.fields.filter(({ type }) => type !== 'boolean'),
    },
    values,
    locale,
    { yes: '', no: '' },
  )
    .slice(0, 3)
    .map(({ value }) => value)
    .join(' · ');
