import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from './admin-errors';
import type CatalogModuleService from '../modules/catalog/service';

export const CATEGORY_RELATIONS = ['fields', 'fields.options'];

const byRank = <Row extends { rank: number; key: string }>(rows: Row[]) =>
  [...rows].sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));

export const withRankedFields = <
  Row extends {
    fields: ({ rank: number; key: string } & {
      options: { rank: number; key: string }[];
    })[];
  },
>(
  category: Row,
): Row => ({
  ...category,
  fields: byRank(category.fields).map((field) => ({
    ...field,
    options: byRank(field.options),
  })),
});

export async function retrieveCategoryField(
  catalog: CatalogModuleService,
  categoryId: string,
  fieldId: string,
) {
  const field = await catalog.retrieveCategoryField(fieldId);
  if (field.category_id !== categoryId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Field ${fieldId} does not belong to Category ${categoryId}`,
    );
  }
  return field;
}

export async function retrieveCategoryFieldOption(
  catalog: CatalogModuleService,
  categoryId: string,
  fieldId: string,
  optionId: string,
) {
  const field = await retrieveCategoryField(catalog, categoryId, fieldId);
  const option = await catalog.retrieveCategoryFieldOption(optionId);
  if (option.field_id !== fieldId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Option ${optionId} does not belong to field ${fieldId}`,
    );
  }
  return { field, option };
}

const requiredField = (field: string, message: string) =>
  adminError(MedusaError.Types.INVALID_DATA, 'FIELD_REQUIRED', message, {
    field,
  });

export function guardCategoryService({
  service_label,
  service_price,
}: {
  service_label: string | null;
  service_price: number | null;
}): void {
  if (service_price !== null && !service_label) {
    throw requiredField(
      'service_label',
      'service_label: Required with a service price',
    );
  }
  if (service_label && service_price === null) {
    throw requiredField(
      'service_price',
      'service_price: Required with a service label',
    );
  }
}
