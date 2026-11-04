import {
  CATALOG_TRANSLATION_LOCALES,
  translated,
  type Category,
} from '@podbor/catalog-contract';

export type CategoryAddon = {
  label: string;
  price: number;
  note: string | null;
};

type ServiceCategory = Pick<
  Category,
  'service_label' | 'service_price' | 'service_note' | 'translations'
>;

type PricedService = ServiceCategory & {
  service_label: string;
  service_price: number;
};

const priced = (category: ServiceCategory | null): PricedService | null =>
  category?.service_label && category.service_price !== null
    ? {
        ...category,
        service_label: category.service_label,
        service_price: category.service_price,
      }
    : null;

export const categoryAddon = (
  category: ServiceCategory | null,
  locale: string,
): CategoryAddon | null => {
  const service = priced(category);
  if (!service) return null;
  return {
    label: translated(service, 'service_label', locale),
    price: service.service_price,
    note: service.service_note
      ? translated(
          {
            service_note: service.service_note,
            translations: service.translations,
          },
          'service_note',
          locale,
        )
      : null,
  };
};

export const addonDataset = (
  category: ServiceCategory | null,
): Record<string, string> => {
  const service = priced(category);
  if (!service) return {};
  const translations = Object.fromEntries(
    CATALOG_TRANSLATION_LOCALES.flatMap((locale) => {
      const label = service.translations?.[locale]?.service_label;
      return label ? [[locale, { label }]] : [];
    }),
  );
  return {
    'data-addon': service.service_label,
    'data-addon-translations': JSON.stringify(translations),
    'data-addon-price': String(service.service_price),
  };
};
