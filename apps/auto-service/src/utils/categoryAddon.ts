import { translated, type Category } from '@podbor/catalog-contract';

export type CategoryAddon = { label: string; price: number };

export const categoryAddon = (
  category: Category | null,
  locale: string,
): CategoryAddon | null =>
  category?.service_label && category.service_price !== null
    ? {
        label: translated(
          {
            service_label: category.service_label,
            translations: category.translations,
          },
          'service_label',
          locale,
        ),
        price: category.service_price,
      }
    : null;
